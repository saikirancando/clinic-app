'use client';

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IncomingCall } from '@/components/incoming-call';
import { OutgoingCall } from '@/components/outgoing-call';
import { api } from '@/lib/api';
import type { CallInfo, CallType } from '@/lib/types';
import { useAuth } from './auth-provider';
import { useRealtimeEvent } from './realtime-provider';

// RealtimeKit touches browser APIs (WebRTC, custom elements), so load it client-side only.
const CallRoom = dynamic(() => import('@/components/call-room'), { ssr: false });

const RING_TIMEOUT_MS = 45_000;

type CallState =
  | { phase: 'idle' }
  | { phase: 'outgoing'; call: CallInfo; authToken: string }
  | { phase: 'incoming'; call: CallInfo }
  | { phase: 'active'; call: CallInfo; authToken: string };

interface CallContextValue {
  state: CallState;
  notice: string | null;
  startCall: (patientId: string, type: CallType) => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<CallState>({ phase: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 4000);
  }, []);

  const isCurrent = (callId: string) => {
    const s = stateRef.current;
    return s.phase !== 'idle' && s.call.id === callId;
  };

  // A patient opening the portal while the doctor is ringing should still see the call.
  useEffect(() => {
    if (user?.role !== 'PATIENT') return;
    api<CallInfo | null>('/calls/current')
      .then((call) => {
        if (call?.status === 'RINGING' && stateRef.current.phase === 'idle') setState({ phase: 'incoming', call });
      })
      .catch(() => undefined);
  }, [user]);

  useRealtimeEvent<CallInfo>('call:incoming', (call) => {
    if (user?.role === 'PATIENT' && stateRef.current.phase === 'idle') setState({ phase: 'incoming', call });
  });

  useRealtimeEvent<CallInfo>('call:accepted', (call) => {
    const s = stateRef.current;
    if (s.phase === 'outgoing' && s.call.id === call.id) setState({ phase: 'active', call, authToken: s.authToken });
    // Accepted from another tab of the same patient: stop ringing here.
    if (s.phase === 'incoming' && s.call.id === call.id) setState({ phase: 'idle' });
  });

  useRealtimeEvent<CallInfo>('call:declined', (call) => {
    if (!isCurrent(call.id)) return;
    setState({ phase: 'idle' });
    if (user?.role === 'DOCTOR') flash(`${call.patientName} declined the call`);
  });

  useRealtimeEvent<CallInfo>('call:ended', (call) => {
    if (!isCurrent(call.id)) return;
    setState({ phase: 'idle' });
    flash(call.status === 'MISSED' ? (user?.role === 'DOCTOR' ? 'No answer' : `Missed call from ${call.doctorName}`) : 'Call ended');
  });

  const endCall = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase === 'idle') return;
    setState({ phase: 'idle' });
    try {
      await api(`/calls/${s.call.id}/end`, { method: 'POST' });
    } catch {
      /* already ended */
    }
  }, []);

  // Doctor side: give up after the ring timeout.
  useEffect(() => {
    if (state.phase !== 'outgoing') return;
    const t = setTimeout(() => {
      void endCall();
      flash('No answer');
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [state, endCall, flash]);

  const startCall = useCallback(
    async (patientId: string, type: CallType) => {
      if (stateRef.current.phase !== 'idle') return;
      try {
        const res = await api<{ call: CallInfo; authToken: string }>('/calls', {
          method: 'POST',
          body: { patientId, type },
        });
        setState({ phase: 'outgoing', call: res.call, authToken: res.authToken });
      } catch (e) {
        flash((e as Error).message);
      }
    },
    [flash],
  );

  const accept = async () => {
    const s = stateRef.current;
    if (s.phase !== 'incoming' || busy) return;
    setBusy(true);
    try {
      const res = await api<{ call: CallInfo; authToken: string }>(`/calls/${s.call.id}/accept`, { method: 'POST' });
      setState({ phase: 'active', call: res.call, authToken: res.authToken });
    } catch (e) {
      setState({ phase: 'idle' });
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    const s = stateRef.current;
    if (s.phase !== 'incoming') return;
    setState({ phase: 'idle' });
    await api(`/calls/${s.call.id}/decline`, { method: 'POST' }).catch(() => undefined);
  };

  const value = useMemo(() => ({ state, notice, startCall }), [state, notice, startCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      {state.phase === 'incoming' && (
        <IncomingCall call={state.call} busy={busy} onAccept={accept} onDecline={decline} />
      )}
      {state.phase === 'outgoing' && <OutgoingCall call={state.call} onCancel={endCall} />}
      {state.phase === 'active' && (
        <CallRoom
          key={state.call.id}
          call={state.call}
          authToken={state.authToken}
          counterpart={user?.role === 'DOCTOR' ? state.call.patientName : state.call.doctorName}
          onEnd={endCall}
        />
      )}
      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}
    </CallContext.Provider>
  );
}

export function useCalls() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls must be used inside CallProvider');
  return ctx;
}
