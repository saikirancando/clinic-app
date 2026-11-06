'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/format';
import type { Message } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useRealtime, useRealtimeEvent } from '@/providers/realtime-provider';
import { SendIcon } from './icons';

const mergeById = (list: Message[], incoming: Message) =>
  list.some((m) => m.id === incoming.id) ? list : [...list, incoming];

/** Doctor <-> patient conversation for a single patient record. */
export function ChatPanel({ patientId, title, subtitle }: { patientId: string; title: string; subtitle?: string }) {
  const { user } = useAuth();
  const { connected } = useRealtime();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    return api<Message[]>(`/conversations/${patientId}/messages`)
      .then((m) => setMessages(m))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  // Refetch on (re)connect so nothing sent while offline is missed.
  useEffect(() => {
    void load();
  }, [load, connected]);

  useRealtimeEvent<Message>('message:new', (m) => {
    if (m.patientId === patientId) setMessages((list) => mergeById(list, m));
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const m = await api<Message>(`/conversations/${patientId}/messages`, { method: 'POST', body: { body } });
      setMessages((list) => mergeById(list, m));
      setDraft('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex h-[32rem] flex-col rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {loading && <p className="text-center text-sm text-slate-400">Loading messages…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-center text-sm text-slate-400">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-teal-100' : 'text-slate-500'}`}>
                  {mine ? 'You' : m.sender.role === 'DOCTOR' ? `Dr. ${m.sender.lastName}` : m.sender.firstName} · {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-4 pb-1 text-xs text-rose-600">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
        <label className="sr-only" htmlFor={`msg-${patientId}`}>Message</label>
        <input
          id={`msg-${patientId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <SendIcon className="h-4 w-4" /> Send
        </button>
      </form>
    </section>
  );
}
