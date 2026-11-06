'use client';

import Pusher, { type Channel } from 'pusher-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useAuth } from './auth-provider';

type Handler = (data: unknown) => void;

interface RealtimeState {
  connected: boolean;
  subscribe: (event: string, handler: Handler) => () => void;
}

const RealtimeContext = createContext<RealtimeState | null>(null);

/**
 * One Pusher connection per logged-in tab, subscribed to the user's private
 * channel. Channel access is authorized by the API (/realtime/auth).
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const channelRef = useRef<Channel | null>(null);
  const handlers = useRef(new Map<string, Set<Handler>>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!user || !token || !key || !cluster) return;

    const pusher = new Pusher(key, {
      cluster,
      channelAuthorization: {
        endpoint: `${API_URL}/realtime/auth`,
        transport: 'ajax',
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    const channel = pusher.subscribe(`private-user-${user.id}`);
    channelRef.current = channel;

    channel.bind('pusher:subscription_succeeded', () => setConnected(true));
    channel.bind_global((event: string, data: unknown) => {
      handlers.current.get(event)?.forEach((h) => h(data));
    });
    pusher.connection.bind('state_change', ({ current }: { current: string }) => {
      if (current !== 'connected') setConnected(false);
      else if (channel.subscribed) setConnected(true);
    });

    return () => {
      channelRef.current = null;
      setConnected(false);
      pusher.disconnect();
    };
  }, [user, token]);

  const subscribe = useCallback((event: string, handler: Handler) => {
    const set = handlers.current.get(event) ?? new Set<Handler>();
    set.add(handler);
    handlers.current.set(event, set);
    return () => void set.delete(handler);
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}

/** Subscribe to a realtime event for the lifetime of the component. */
export function useRealtimeEvent<T>(event: string, handler: (data: T) => void) {
  const { subscribe } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(event, (d) => ref.current(d as T)), [event, subscribe]);
}
