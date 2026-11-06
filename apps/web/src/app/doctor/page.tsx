'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SearchIcon } from '@/components/icons';
import { api } from '@/lib/api';
import { age, formatTime, fullName, initials, titleCase } from '@/lib/format';
import type { PatientSummary } from '@/lib/types';

export default function PatientListPage() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PatientSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = { cancelled: false };
    const t = setTimeout(() => {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      api<PatientSummary[]>(`/patients${q}`)
        .then((p) => !ctrl.cancelled && (setPatients(p), setError(null)))
        .catch((e) => !ctrl.cancelled && setError(e.message));
    }, 250);
    return () => {
      ctrl.cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My patients</h1>
          <p className="text-sm text-slate-500">
            {patients ? `${patients.length} patient${patients.length === 1 ? '' : 's'}` : 'Loading…'} assigned to you
          </p>
        </div>
        <label className="relative w-full sm:w-80">
          <span className="sr-only">Search patients</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, MRN or email"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </label>
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="hidden px-4 py-3 md:table-cell">MRN</th>
              <th className="hidden px-4 py-3 sm:table-cell">Age / Sex</th>
              <th className="hidden px-4 py-3 lg:table-cell">Conditions</th>
              <th className="hidden px-4 py-3 md:table-cell">Active meds</th>
              <th className="hidden px-4 py-3 lg:table-cell">Last message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/doctor/patients/${p.id}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-medium text-teal-700">
                      {initials(p)}
                    </span>
                    <span>
                      <span className="block font-medium text-slate-900 hover:text-teal-700">{fullName(p)}</span>
                      <span className="block text-xs text-slate-500">{p.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">{p.mrn}</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  {age(p.dateOfBirth)} / {titleCase(p.sex)}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {p.conditions.map((c) => (
                      <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{c}</span>
                    ))}
                  </div>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">{p.activeMedications}</td>
                <td className="hidden max-w-56 px-4 py-3 lg:table-cell">
                  {p.lastMessage ? (
                    <>
                      <span className="block truncate text-slate-700">{p.lastMessage.body}</span>
                      <span className="text-xs text-slate-400">{formatTime(p.lastMessage.createdAt)}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
            {patients?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No patients match “{search}”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
