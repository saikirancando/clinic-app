'use client';

import { useEffect } from 'react';
import type { CallInfo } from '@/lib/types';
import { PhoneIcon, VideoIcon } from './icons';

/** Simple ringtone generated with Web Audio so no asset is needed. */
function useRingtone() {
  useEffect(() => {
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const ring = () => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 480;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    };
    ring();
    const id = setInterval(ring, 2000);
    return () => {
      clearInterval(id);
      void ctx?.close();
    };
  }, []);
}

export function IncomingCall({
  call,
  busy,
  onAccept,
  onDecline,
}: {
  call: CallInfo;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  useRingtone();
  const isVideo = call.type === 'VIDEO';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="incoming-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-teal-100 text-teal-700">
          {isVideo ? <VideoIcon className="h-8 w-8" /> : <PhoneIcon className="h-8 w-8" />}
        </div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Incoming {isVideo ? 'video' : 'audio'} call</p>
        <h2 id="incoming-title" className="mt-1 text-xl font-semibold text-slate-900">{call.doctorName}</h2>
        <div className="mt-6 flex gap-3">
          <button onClick={onDecline} disabled={busy} className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 font-medium text-white hover:bg-rose-700 disabled:opacity-50">
            Decline
          </button>
          <button onClick={onAccept} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? 'Connecting…' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
