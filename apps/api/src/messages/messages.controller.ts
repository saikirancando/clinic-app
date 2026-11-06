import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}

class ListMessagesQuery {
  @IsOptional()
  @IsDateString()
  before?: string;
}

/** Shared by doctors and patients; access is enforced per patient record. */
@Controller('conversations/:patientId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
    @Query() query: ListMessagesQuery,
  ) {
    return this.messages.list(user, patientId, query.before);
  }

  @Post()
  send(@CurrentUser() user: AuthUser, @Param('patientId') patientId: string, @Body() dto: SendMessageDto) {
    return this.messages.send(user, patientId, dto.body);
  }
}
