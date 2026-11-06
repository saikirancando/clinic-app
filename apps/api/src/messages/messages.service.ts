import { Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { PatientAccessService } from '../auth/patient-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

const messageSelect = {
  id: true,
  patientId: true,
  senderId: true,
  body: true,
  createdAt: true,
  readAt: true,
  sender: { select: { firstName: true, lastName: true, role: true } },
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(user: AuthUser, patientId: string, before?: string) {
    await this.access.assertAccess(user, patientId);
    const messages = await this.prisma.message.findMany({
      where: { patientId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: messageSelect,
    });

    // Mark messages from the other party as read.
    await this.prisma.message.updateMany({
      where: { patientId, senderId: { not: user.userId }, readAt: null },
      data: { readAt: new Date() },
    });

    return messages.reverse();
  }

  async send(user: AuthUser, patientId: string, body: string) {
    const patient = await this.access.assertAccess(user, patientId);
    const message = await this.prisma.message.create({
      data: { patientId, senderId: user.userId, body: body.trim() },
      select: messageSelect,
    });
    // Fan out to both participants (the sender's other tabs stay in sync too).
    await this.realtime.publishToUsers([patient.userId, patient.doctor.userId], 'message:new', message);
    return message;
  }
}
