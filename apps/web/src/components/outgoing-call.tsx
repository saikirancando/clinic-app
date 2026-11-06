'use client';

import type { CallInfo } from '@/lib/types';
import { PhoneIcon, VideoIcon } from './icons';

export function OutgoingCall({ call, onCancel }: { call: CallInfo; onCancel: () => void }) {
  const isVideo = call.type === 'VIDEO';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-sky-100 text-sky-700">
          {isVideo ? <VideoIcon className="h-8 w-8" /> : <PhoneIcon className="h-8 w-8" />}
        </div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Calling ({isVideo ? 'video' : 'audio'})</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{call.patientName}</h2>
        <p className="mt-2 text-sm text-slate-500">Waiting for the patient to answer…</p>
        <button onClick={onCancel} className="mt-6 w-full rounded-lg bg-rose-600 px-4 py-2.5 font-medium text-white hover:bg-rose-700">
          Cancel call
        </button>
      </div>
    </div>
  );
}
