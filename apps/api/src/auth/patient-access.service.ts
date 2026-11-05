import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth-user';

/**
 * Central place for record-level access control:
 *  - a doctor may only access patients assigned to them
 *  - a patient may only access their own record
 * Unauthorized access returns 404 so we don't reveal which patient IDs exist.
 */
@Injectable()
export class PatientAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAccess(user: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, userId: true, doctorId: true, doctor: { select: { userId: true } } },
    });
    if (!patient || !PatientAccessService.canAccess(user, patient)) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  static canAccess(user: AuthUser, patient: { id: string; doctorId: string }): boolean {
    if (user.role === 'DOCTOR') return !!user.doctorId && patient.doctorId === user.doctorId;
    if (user.role === 'PATIENT') return !!user.patientId && patient.id === user.patientId;
    return false;
  }
}
