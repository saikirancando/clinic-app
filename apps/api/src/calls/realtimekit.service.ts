import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallType } from '@prisma/client';

interface RtkResponse<T> {
  success: boolean;
  data?: T;
  errors?: { message: string }[];
}

/**
 * Thin client for the Cloudflare RealtimeKit REST API.
 * Docs: https://developers.cloudflare.com/realtime/realtimekit/
 * The API token stays on the server; the browser only ever receives
 * a per-participant auth token scoped to one meeting.
 */
@Injectable()
export class RealtimeKitService {
  private readonly logger = new Logger(RealtimeKitService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl() {
    const accountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const appId = this.config.get<string>('RTK_APP_ID');
    if (!accountId || !appId || !this.config.get('CLOUDFLARE_API_TOKEN')) {
      throw new ServiceUnavailableException('Calling is not configured on the server');
    }
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}`;
  }

  presetFor(type: CallType, role: 'host' | 'participant'): string {
    const defaults = {
      VIDEO: { host: 'group_call_host', participant: 'group_call_participant' },
      AUDIO: { host: 'voice_call_host', participant: 'voice_call_participant' },
    } as const;
    const key = `RTK_PRESET_${type}_${role === 'host' ? 'HOST' : 'PARTICIPANT'}`;
    return this.config.get<string>(key) || defaults[type][role];
  }

  async createMeeting(title: string): Promise<string> {
    const data = await this.request<{ id: string }>('/meetings', { title });
    return data.id;
  }

  async addParticipant(
    meetingId: string,
    input: { name: string; presetName: string; customParticipantId: string },
  ): Promise<string> {
    const data = await this.request<{ id: string; token: string }>(
      `/meetings/${meetingId}/participants`,
      {
        name: input.name,
        preset_name: input.presetName,
        custom_participant_id: input.customParticipantId,
        // Tokens are short lived: they're only needed for this consultation.
        token: { expires_on: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
      },
    );
    return data.token;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.get<string>('CLOUDFLARE_API_TOKEN')}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as RtkResponse<T>;
    if (!res.ok || !json.success || !json.data) {
      const detail = json.errors?.map((e) => e.message).join('; ') || res.statusText;
      this.logger.error(`RealtimeKit ${path} failed (${res.status}): ${detail}`);
      throw new ServiceUnavailableException('Could not set up the call. Please try again.');
    }
    return json.data;
  }
}
