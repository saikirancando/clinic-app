'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { fullName } from '@/lib/format';
import type { Role } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useRealtime } from '@/providers/realtime-provider';

/** Authenticated layout that also enforces the portal's role on the client. */
export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { connected } = useRealtime();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== role) router.replace(user.role === 'DOCTOR' ? '/doctor' : '/patient');
  }, [user, loading, role, router]);

  if (loading || !user || user.role !== role) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
  }

  const subtitle = user.role === 'DOCTOR' ? user.doctor?.specialty : `Patient · ${user.patient?.mrn}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href={role === 'DOCTOR' ? '/doctor' : '/patient'} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 font-bold text-white">R</span>
            <span className="font-semibold">SKY Clinic</span>
            <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 sm:inline">
              {role === 'DOCTOR' ? 'Doctor portal' : 'Patient portal'}
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span
              className={`hidden items-center gap-1.5 text-xs sm:flex ${connected ? 'text-emerald-700' : 'text-slate-400'}`}
              title={connected ? 'Realtime connected' : 'Realtime disconnected'}
            >
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {connected ? 'Live' : 'Offline'}
            </span>
            <div className="text-right">
              <p className="text-sm font-medium">{user.role === 'DOCTOR' ? `Dr. ${fullName(user)}` : fullName(user)}</p>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
