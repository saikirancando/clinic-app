import { Body, Controller, ForbiddenException, HttpCode, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { RealtimeService, userChannel } from './realtime.service';

class ChannelAuthDto {
  @IsString()
  socket_id: string;

  @IsString()
  channel_name: string;
}

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /** Pusher private-channel authorization: users may only subscribe to their own channel. */
  @Post('auth')
  @HttpCode(200)
  auth(@CurrentUser() user: AuthUser, @Body() dto: ChannelAuthDto) {
    if (dto.channel_name !== userChannel(user.userId)) {
      throw new ForbiddenException('Cannot subscribe to this channel');
    }
    return this.realtime.authorizeChannel(dto.socket_id, dto.channel_name);
  }
}
