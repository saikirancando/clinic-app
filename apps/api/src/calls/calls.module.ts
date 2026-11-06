import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { RealtimeKitService } from './realtimekit.service';

@Module({
  controllers: [CallsController],
  providers: [CallsService, RealtimeKitService],
})
export class CallsModule {}
