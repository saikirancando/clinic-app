import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, JwtPayload } from './auth-user';

const userInclude = {
  doctor: true,
  patient: { include: { doctor: { include: { user: true } } } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userInclude,
    });
    // Same error for unknown email and wrong password to avoid account enumeration.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      doctorId: user.doctor?.id,
      patientId: user.patient?.id,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: this.toProfile(user),
    };
  }

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      include: userInclude,
    });
    if (!user) throw new NotFoundException();
    return this.toProfile(user);
  }

  private toProfile(user: {
    id: string;
    email: string;
    role: AuthUser['role'];
    firstName: string;
    lastName: string;
    doctor: { id: string; specialty: string } | null;
    patient: {
      id: string;
      mrn: string;
      doctor: { id: string; specialty: string; user: { firstName: string; lastName: string } };
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      doctor: user.doctor ? { id: user.doctor.id, specialty: user.doctor.specialty } : null,
      patient: user.patient
        ? {
            id: user.patient.id,
            mrn: user.patient.mrn,
            doctor: {
              id: user.patient.doctor.id,
              specialty: user.patient.doctor.specialty,
              name: `Dr. ${user.patient.doctor.user.firstName} ${user.patient.doctor.user.lastName}`,
            },
          }
        : null,
    };
  }
}
