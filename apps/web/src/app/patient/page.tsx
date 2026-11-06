'use client';

import { ChatPanel } from '@/components/chat-panel';
import { useAuth } from '@/providers/auth-provider';

export default function PatientHome() {
  const { user } = useAuth();
  const patient = user?.patient;
  if (!user || !patient) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Hello, {user.firstName}</h1>
        <p className="mb-6 text-sm text-slate-500">Message your doctor below. You’ll get a notification here when your doctor calls.</p>
        <ChatPanel patientId={patient.id} title={patient.doctor.name} subtitle={patient.doctor.specialty} />
      </div>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Your care team</h2>
          <p className="text-sm font-medium">{patient.doctor.name}</p>
          <p className="text-sm text-slate-500">{patient.doctor.specialty}</p>
          <p className="mt-3 text-xs text-slate-500">MRN <span className="font-mono">{patient.mrn}</span></p>
        </section>
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <h2 className="mb-1 font-semibold">Audio & video visits</h2>
          <p>Calls are started by your doctor. When they call, you can accept or decline, and end the call at any time. Keep this page open to receive calls.</p>
        </section>
      </aside>
    </div>
  );
}
