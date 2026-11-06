import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CallType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { CallsService } from './calls.service';

class InitiateCallDto {
  @IsString()
  patientId: string;

  @IsEnum(CallType)
  type: CallType;
}

@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  /** Only doctors can start a call; patients receive 403. */
  @Post()
  @Roles('DOCTOR')
  initiate(@CurrentUser() user: AuthUser, @Body() dto: InitiateCallDto) {
    return this.calls.initiate(user, dto.patientId, dto.type);
  }

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.calls.current(user);
  }

  @Get('patient/:patientId')
  history(@CurrentUser() user: AuthUser, @Param('patientId') patientId: string) {
    return this.calls.history(user, patientId);
  }

  @Post(':id/accept')
  @Roles('PATIENT')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.calls.accept(user, id);
  }

  @Post(':id/decline')
  @Roles('PATIENT')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.calls.decline(user, id);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.calls.end(user, id);
  }
}
