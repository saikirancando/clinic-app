import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../src/auth/auth-user';
import { PatientAccessService } from '../src/auth/patient-access.service';
import { RolesGuard } from '../src/auth/roles.guard';

const doctorA: AuthUser = { userId: 'u-doc-a', role: 'DOCTOR', doctorId: 'doc-a' };
const doctorB: AuthUser = { userId: 'u-doc-b', role: 'DOCTOR', doctorId: 'doc-b' };
const patient1: AuthUser = { userId: 'u-p1', role: 'PATIENT', patientId: 'p1' };
const patient2: AuthUser = { userId: 'u-p2', role: 'PATIENT', patientId: 'p2' };
const recordP1 = { id: 'p1', doctorId: 'doc-a' };

describe('PatientAccessService.canAccess', () => {
  it('allows a doctor to access their assigned patient', () => {
    expect(PatientAccessService.canAccess(doctorA, recordP1)).toBe(true);
  });

  it("denies a doctor access to another doctor's patient", () => {
    expect(PatientAccessService.canAccess(doctorB, recordP1)).toBe(false);
  });

  it('allows a patient to access only their own record', () => {
    expect(PatientAccessService.canAccess(patient1, recordP1)).toBe(true);
    expect(PatientAccessService.canAccess(patient2, recordP1)).toBe(false);
  });
});

describe('PatientAccessService.assertAccess', () => {
  const prisma = { patient: { findUnique: jest.fn() } };
  const service = new PatientAccessService(prisma as never);

  it('throws NotFound for unassigned patients (does not leak existence)', async () => {
    prisma.patient.findUnique.mockResolvedValue({ ...recordP1, userId: 'u-p1', doctor: { userId: 'u-doc-a' } });
    await expect(service.assertAccess(doctorB, 'p1')).rejects.toThrow('Patient not found');
  });

  it('throws NotFound for missing patients', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);
    await expect(service.assertAccess(doctorA, 'nope')).rejects.toThrow('Patient not found');
  });
});

describe('RolesGuard', () => {
  const ctx = (user: AuthUser) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('blocks patients from doctor-only routes (e.g. POST /calls)', () => {
    const reflector = { getAllAndOverride: () => ['DOCTOR'] } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(ctx(patient1))).toThrow(ForbiddenException);
  });

  it('allows doctors on doctor-only routes', () => {
    const reflector = { getAllAndOverride: () => ['DOCTOR'] } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(ctx(doctorA))).toBe(true);
  });

  it('allows any authenticated user when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(ctx(patient1))).toBe(true);
  });
});
