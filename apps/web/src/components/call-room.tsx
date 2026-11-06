'use client';

import { RealtimeKitProvider, useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { useEffect, useRef } from 'react';
import type { CallInfo } from '@/lib/types';

/**
 * Full-screen call using the Cloudflare RealtimeKit UI Kit.
 * Audio vs video is decided server-side by the participant preset
 * (a "Voice" preset disables cameras), and mirrored in the media defaults here.
 */
export default function CallRoom({
  call,
  authToken,
  counterpart,
  onEnd,
}: {
  call: CallInfo;
  authToken: string;
  counterpart: string;
  onEnd: () => void;
}) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const initialized = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void initMeeting({
      authToken,
      defaults: { audio: true, video: call.type === 'VIDEO' },
    });
  }, [authToken, call.type, initMeeting]);

  useEffect(() => {
    if (!meeting) return;
    // Leaving through the UI Kit's own "leave" button ends the call for both sides.
    const handleLeft = () => onEndRef.current();
    meeting.self.on('roomLeft', handleLeft);
    return () => {
      meeting.self.off('roomLeft', handleLeft);
      if (meeting.self.roomJoined) void meeting.leave();
    };
  }, [meeting]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-white">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{call.type === 'VIDEO' ? 'Video' : 'Audio'} consultation</p>
          <p className="font-medium">{counterpart}</p>
        </div>
        <button onClick={onEnd} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium hover:bg-rose-700">
          End call
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {meeting ? (
          <RealtimeKitProvider value={meeting}>
            <RtkMeeting meeting={meeting} mode="fill" showSetupScreen={false} />
          </RealtimeKitProvider>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">Connecting…</div>
        )}
      </div>
    </div>
  );
}
