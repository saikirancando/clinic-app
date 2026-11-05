import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

export type RealtimeEvent =
  | 'message:new'
  | 'call:incoming'
  | 'call:accepted'
  | 'call:declined'
  | 'call:ended';

/** Each user has a private channel; the server is the only publisher. */
export const userChannel = (userId: string) => `private-user-${userId}`;

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly pusher: Pusher | null;

  constructor(config: ConfigService) {
    const appId = config.get<string>('PUSHER_APP_ID');
    const key = config.get<string>('PUSHER_KEY');
    const secret = config.get<string>('PUSHER_SECRET');
    const cluster = config.get<string>('PUSHER_CLUSTER');
    this.pusher =
      appId && key && secret && cluster
        ? new Pusher({ appId, key, secret, cluster, useTLS: true })
        : null;
    if (!this.pusher) this.logger.warn('Pusher is not configured; realtime events are disabled');
  }

  async publishToUsers(userIds: string[], event: RealtimeEvent, data: unknown) {
    if (!this.pusher) return;
    const channels = [...new Set(userIds)].map(userChannel);
    try {
      await this.pusher.trigger(channels, event, data);
    } catch (err) {
      // Data is already persisted; clients can recover by refetching.
      this.logger.error(`Failed to publish ${event}`, err as Error);
    }
  }

  authorizeChannel(socketId: string, channel: string) {
    if (!this.pusher) throw new Error('Realtime is not configured');
    return this.pusher.authorizeChannel(socketId, channel);
  }
}
