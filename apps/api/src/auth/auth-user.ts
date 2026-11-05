import { Role } from '@prisma/client';

/** Identity attached to every authenticated request (decoded from the JWT). */
export interface AuthUser {
  userId: string;
  role: Role;
  doctorId?: string;
  patientId?: string;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  doctorId?: string;
  patientId?: string;
}
