import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PatientAccessService } from '../auth/patient-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  /** Lists only the patients assigned to the logged-in doctor. */
  async listForDoctor(doctorId: string, search?: string) {
    const term = search?.trim();
    const where: Prisma.PatientWhereInput = { doctorId };
    if (term) {
      where.OR = [
        { mrn: { contains: term, mode: 'insensitive' } },
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const patients = await this.prisma.patient.findMany({
      where,
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      select: {
        id: true,
        mrn: true,
        dateOfBirth: true,
        sex: true,
        conditions: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { prescriptions: { where: { status: 'ACTIVE' } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true } },
      },
    });

    return patients.map(({ user, _count, messages, ...p }) => ({
      ...p,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      activeMedications: _count.prescriptions,
      lastMessage: messages[0] ?? null,
    }));
  }

  async getProfile(user: AuthUser, patientId: string) {
    await this.access.assertAccess(user, patientId);
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        doctor: { select: { id: true, specialty: true, user: { select: { firstName: true, lastName: true } } } },
        labResults: { orderBy: [{ collectedAt: 'desc' }, { panel: 'asc' }] },
        imagingReports: { orderBy: { performedAt: 'desc' } },
        prescriptions: {
          orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
          include: { prescribedBy: { select: { user: { select: { firstName: true, lastName: true } } } } },
        },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async addPrescription(user: AuthUser, patientId: string, dto: CreatePrescriptionDto) {
    await this.access.assertAccess(user, patientId);
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = dto.durationDays ? new Date(startDate.getTime() + dto.durationDays * DAY_MS) : null;

    return this.prisma.prescription.create({
      data: {
        patientId,
        prescribedById: user.doctorId!,
        drugName: dto.drugName.trim(),
        dosage: dto.dosage.trim(),
        route: dto.route,
        frequency: dto.frequency.trim(),
        durationDays: dto.durationDays,
        quantity: dto.quantity,
        refills: dto.refills ?? 0,
        instructions: dto.instructions?.trim() || null,
        startDate,
        endDate,
        status: 'ACTIVE',
      },
      include: { prescribedBy: { select: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }
}
