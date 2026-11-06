'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import type { Prescription } from '@/lib/types';

const ROUTES = ['Oral', 'Topical', 'Inhaled', 'Subcutaneous', 'Intramuscular', 'Intravenous', 'Sublingual', 'Ophthalmic'];
const empty = { drugName: '', dosage: '', route: 'Oral', frequency: '', durationDays: '', quantity: '', refills: '0', instructions: '' };

export function PrescriptionForm({ patientId, onCreated }: { patientId: string; onCreated: (p: Prescription) => void }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api<Prescription>(`/patients/${patientId}/prescriptions`, {
        method: 'POST',
        body: {
          drugName: form.drugName,
          dosage: form.dosage,
          route: form.route,
          frequency: form.frequency,
          durationDays: form.durationDays ? Number(form.durationDays) : undefined,
          quantity: form.quantity ? Number(form.quantity) : undefined,
          refills: Number(form.refills || 0),
          instructions: form.instructions || undefined,
          // The prescriber's local calendar date (YYYY-MM-DD), not the server's UTC date.
          startDate: new Date().toLocaleDateString('en-CA'),
        },
      });
      onCreated(created);
      setForm(empty);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100';
  const label = 'block text-xs font-medium text-slate-600';

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 font-semibold">New prescription</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`${label} sm:col-span-2`}>Medication *
          <input required value={form.drugName} onChange={set('drugName')} placeholder="e.g. Amoxicillin" className={input} />
        </label>
        <label className={label}>Dosage *
          <input required value={form.dosage} onChange={set('dosage')} placeholder="e.g. 500 mg" className={input} />
        </label>
        <label className={label}>Route *
          <select value={form.route} onChange={set('route')} className={input}>
            {ROUTES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className={`${label} sm:col-span-2`}>Frequency *
          <input required value={form.frequency} onChange={set('frequency')} placeholder="e.g. Three times daily" className={input} />
        </label>
        <label className={label}>Duration (days)
          <input type="number" min={1} max={365} value={form.durationDays} onChange={set('durationDays')} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Quantity
            <input type="number" min={1} max={1000} value={form.quantity} onChange={set('quantity')} className={input} />
          </label>
          <label className={label}>Refills
            <input type="number" min={0} max={12} value={form.refills} onChange={set('refills')} className={input} />
          </label>
        </div>
        <label className={`${label} sm:col-span-2 lg:col-span-4`}>Instructions
          <textarea rows={2} maxLength={500} value={form.instructions} onChange={set('instructions')} placeholder="e.g. Take with food" className={input} />
        </label>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Add prescription'}
        </button>
      </div>
    </form>
  );
}
