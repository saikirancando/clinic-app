import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Call, CallStatus, CallType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PatientAccessService } from '../auth/patient-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { RealtimeKitService } from './realtimekit.service';

/** An unanswered call is treated as missed after this long. */
export const RING_TIMEOUT_MS = 45_000;

const callInclude = {
  doctor: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
  patient: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.CallInclude;

type CallWithParties = Prisma.CallGetPayload<{ include: typeof callInclude }>;

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
    private readonly realtime: RealtimeService,
    private readonly rtk: RealtimeKitService,
  ) {}

  /** Doctor-only (enforced by @Roles on the controller and re-checked here). */
  async initiate(user: AuthUser, patientId: string, type: CallType) {
    if (user.role !== 'DOCTOR' || !user.doctorId) throw new BadRequestException('Only doctors can start calls');
    await this.access.assertAccess(user, patientId);
    await this.expireStaleRinging();

    const busy = await this.prisma.call.findFirst({
      where: {
        status: { in: ['RINGING', 'ACTIVE'] },
        OR: [{ doctorId: user.doctorId }, { patientId }],
      },
    });
    if (busy) throw new ConflictException('There is already a call in progress');

    const patient = await this.prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: { mrn: true },
    });
    const doctor = await this.prisma.doctor.findUniqueOrThrow({
      where: { id: user.doctorId },
      select: { user: { select: { firstName: true, lastName: true } } },
    });

    const meetingId = await this.rtk.createMeeting(`${type === 'VIDEO' ? 'Video' : 'Audio'} consultation ${patient.mrn}`);
    const authToken = await this.rtk.addParticipant(meetingId, {
      name: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
      presetName: this.rtk.presetFor(type, 'host'),
      customParticipantId: user.userId,
    });

    const call = await this.prisma.call.create({
      data: { patientId, doctorId: user.doctorId, type, meetingId, status: 'RINGING' },
      include: callInclude,
    });

    const dto = this.toDto(call);
    await this.realtime.publishToUsers([call.patient.userId], 'call:incoming', dto);
    return { call: dto, authToken };
  }

  async accept(user: AuthUser, callId: string) {
    const call = await this.findForParticipant(user, callId);
    if (user.role !== 'PATIENT') throw new BadRequestException('Only the patient can answer this call');
    if (call.status !== 'RINGING' || this.isStale(call)) {
      throw new ConflictException('This call is no longer available');
    }

    const authToken = await this.rtk.addParticipant(call.meetingId, {
      name: `${call.patient.user.firstName} ${call.patient.user.lastName}`,
      presetName: this.rtk.presetFor(call.type, 'participant'),
      customParticipantId: user.userId,
    });

    // Conditional update guards against a race with end/decline.
    const updated = await this.transition(call.id, ['RINGING'], { status: 'ACTIVE', answeredAt: new Date() });
    const dto = this.toDto(updated);
    await this.realtime.publishToUsers([call.doctor.userId, call.patient.userId], 'call:accepted', dto);
    return { call: dto, authToken };
  }

  async decline(user: AuthUser, callId: string) {
    const call = await this.findForParticipant(user, callId);
    if (user.role !== 'PATIENT') throw new BadRequestException('Only the patient can decline this call');
    const updated = await this.transition(call.id, ['RINGING'], { status: 'DECLINED', endedAt: new Date() });
    const dto = this.toDto(updated);
    await this.realtime.publishToUsers([call.doctor.userId, call.patient.userId], 'call:declined', dto);
    return dto;
  }

  /** Either participant may end (or cancel) the call. Idempotent. */
  async end(user: AuthUser, callId: string) {
    const call = await this.findForParticipant(user, callId);
    if (call.status !== 'RINGING' && call.status !== 'ACTIVE') return this.toDto(call);

    const status: CallStatus = call.status === 'RINGING' ? 'MISSED' : 'ENDED';
    const updated = await this.transition(call.id, ['RINGING', 'ACTIVE'], { status, endedAt: new Date() });
    const dto = this.toDto(updated);
    await this.realtime.publishToUsers([call.doctor.userId, call.patient.userId], 'call:ended', dto);
    return dto;
  }

  /** Lets a client that just loaded (e.g. patient opening the portal) discover a ringing call. */
  async current(user: AuthUser) {
    await this.expireStaleRinging();
    const where: Prisma.CallWhereInput =
      user.role === 'DOCTOR' ? { doctorId: user.doctorId } : { patientId: user.patientId };
    const call = await this.prisma.call.findFirst({
      where: { ...where, status: { in: ['RINGING', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
      include: callInclude,
    });
    return call ? this.toDto(call) : null;
  }

  async history(user: AuthUser, patientId: string) {
    await this.access.assertAccess(user, patientId);
    const calls = await this.prisma.call.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: callInclude,
    });
    return calls.map((c) => this.toDto(c));
  }

  private async findForParticipant(user: AuthUser, callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId }, include: callInclude });
    const isParticipant =
      !!call &&
      ((user.role === 'DOCTOR' && call.doctorId === user.doctorId) ||
        (user.role === 'PATIENT' && call.patientId === user.patientId));
    if (!call || !isParticipant) throw new NotFoundException('Call not found');
    return call;
  }

  private async transition(id: string, from: CallStatus[], data: Prisma.CallUpdateInput) {
    const { count } = await this.prisma.call.updateMany({ where: { id, status: { in: from } }, data });
    if (count === 0) throw new ConflictException('This call is no longer available');
    return this.prisma.call.findUniqueOrThrow({ where: { id }, include: callInclude });
  }

  private isStale(call: Call) {
    return Date.now() - call.createdAt.getTime() > RING_TIMEOUT_MS;
  }

  private async expireStaleRinging() {
    await this.prisma.call.updateMany({
      where: { status: 'RINGING', createdAt: { lt: new Date(Date.now() - RING_TIMEOUT_MS) } },
      data: { status: 'MISSED', endedAt: new Date() },
    });
  }

  private toDto(call: CallWithParties) {
    return {
      id: call.id,
      type: call.type,
      status: call.status,
      patientId: call.patientId,
      doctorId: call.doctorId,
      doctorName: `Dr. ${call.doctor.user.firstName} ${call.doctor.user.lastName}`,
      patientName: `${call.patient.user.firstName} ${call.patient.user.lastName}`,
      createdAt: call.createdAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
    };
  }
}
