import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { CreatePrescriptionDto, ListPatientsQuery } from './dto';
import { PatientsService } from './patients.service';

@Controller('patients')
@Roles('DOCTOR')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListPatientsQuery) {
    return this.patients.listForDoctor(user.doctorId!, query.search);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patients.getProfile(user, id);
  }

  @Post(':id/prescriptions')
  addPrescription(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreatePrescriptionDto,
  ) {
    return this.patients.addPrescription(user, id, dto);
  }
}
