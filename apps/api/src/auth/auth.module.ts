import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PatientAccessService } from './patient-access.service';

type ExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

/**
 * Accepts "8h", "30m", "1d" or a number of seconds. Blank, quoted or malformed
 * values (easy to enter by mistake in a hosting dashboard) fall back to 8h
 * instead of crashing every login.
 */
export function parseExpiresIn(raw: string | undefined, fallback: ExpiresIn = '8h'): ExpiresIn {
  const value = raw?.trim().replace(/^["']|["']$/g, '').trim();
  if (!value) return fallback;
  if (/^\d+$/.test(value)) return Number(value);
  if (/^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y)$/i.test(value)) return value as ExpiresIn;
  return fallback;
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: parseExpiresIn(config.get<string>('JWT_EXPIRES_IN')) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PatientAccessService],
  exports: [PatientAccessService],
})
export class AuthModule {}
