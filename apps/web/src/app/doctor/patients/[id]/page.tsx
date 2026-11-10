'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LabFlagBadge, RxStatusBadge } from '@/components/badges';
import { ChatPanel } from '@/components/chat-panel';
import { ArrowLeftIcon, PhoneIcon, VideoIcon } from '@/components/icons';
import { PrescriptionForm } from '@/components/prescription-form';
import { api } from '@/lib/api';
import { age, formatDate, fullName, titleCase } from '@/lib/format';
import type { LabResult, PatientProfile, Prescription } from '@/lib/types';
import { useCalls } from '@/providers/call-provider';

const TABS = ['Overview', 'Lab results', 'Imaging', 'Medications'] as const;
type Tab = (typeof TABS)[number];

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { startCall, state: callState } = useCalls();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');

  useEffect(() => {
    api<PatientProfile>(`/patients/${id}`)
      .then(setPatient)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-700">{error}</p>
        <Link href="/doctor" className="mt-3 inline-block text-teal-700 hover:underline">Back to patients</Link>
      </div>
    );
  }
  if (!patient) return <p className="text-slate-500">Loading patient…</p>;

  const name = fullName(patient.user);
  const callDisabled = callState.phase !== 'idle';
  const onPrescribed = (p: Prescription) => setPatient((cur) => cur && { ...cur, prescriptions: [p, ...cur.prescriptions] });

  return (
    <div>
      <Link href="/doctor" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-teal-700">
        <ArrowLeftIcon className="h-4 w-4" /> All patients
      </Link>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono">{patient.mrn}</span> · {age(patient.dateOfBirth)} y · {titleCase(patient.sex)} · Blood {patient.bloodType}
          </p>
          {patient.allergies.length > 0 && (
            <p className="mt-2 text-sm">
              <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">Allergies</span>{' '}
              {patient.allergies.join(', ')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => startCall(patient.id, 'AUDIO')}
            disabled={callDisabled}
            className="flex items-center gap-2 rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          >
            <PhoneIcon className="h-4 w-4" /> Audio call
          </button>
          <button
            onClick={() => startCall(patient.id, 'VIDEO')}
            disabled={callDisabled}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <VideoIcon className="h-4 w-4" /> Video call
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium sm:flex-none sm:px-4 ${tab === t ? 'bg-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Overview' && <Overview patient={patient} />}
          {tab === 'Lab results' && <Labs labs={patient.labResults} />}
          {tab === 'Imaging' && <Imaging patient={patient} />}
          {tab === 'Medications' && (
            <div className="space-y-4">
              <PrescriptionForm patientId={patient.id} onCreated={onPrescribed} />
              <Medications prescriptions={patient.prescriptions} />
            </div>
          )}
        </div>

        <ChatPanel patientId={patient.id} title={`Messages with ${patient.user.firstName}`} subtitle={patient.user.email} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Overview({ patient }: { patient: PatientProfile }) {
  const rows: [string, string][] = [
    ['Date of birth', formatDate(patient.dateOfBirth)],
    ['Sex', titleCase(patient.sex)],
    ['Phone', patient.phone],
    ['Email', patient.user.email],
    ['Address', patient.address],
    ['Height / Weight', `${patient.heightCm} cm / ${patient.weightKg} kg`],
    ['Blood type', patient.bloodType],
    ['Emergency contact', patient.emergencyContact],
    ['Assigned doctor', `Dr. ${fullName(patient.doctor.user)} (${patient.doctor.specialty})`],
  ];
  const active = patient.prescriptions.filter((p) => p.status === 'ACTIVE');
  return (
    <div className="space-y-4">
      <Card title="Demographics">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Conditions">
          <ul className="list-inside list-disc text-sm">{patient.conditions.map((c) => <li key={c}>{c}</li>)}</ul>
        </Card>
        <Card title="Active medications">
          {active.length ? (
            <ul className="space-y-1 text-sm">
              {active.map((p) => <li key={p.id}><span className="font-medium">{p.drugName}</span> {p.dosage} - {p.frequency}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">None</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Labs({ labs }: { labs: LabResult[] }) {
  const byDate = useMemo(() => {
    const groups = new Map<string, LabResult[]>();
    for (const l of labs) {
      const k = l.collectedAt.slice(0, 10);
      groups.set(k, [...(groups.get(k) ?? []), l]);
    }
    return [...groups.entries()];
  }, [labs]);

  if (!labs.length) return <Card title="Lab results"><p className="text-sm text-slate-500">No lab results.</p></Card>;
  return (
    <div className="space-y-4">
      {byDate.map(([date, items]) => (
        <Card key={date} title={`Collected ${formatDate(date)}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2 pr-4">Test</th><th className="py-2 pr-4">Panel</th><th className="py-2 pr-4">Result</th><th className="py-2 pr-4">Reference</th><th className="py-2">Flag</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-4 font-medium">{l.testName}</td>
                    <td className="py-2 pr-4 text-slate-500">{l.panel}</td>
                    <td className="py-2 pr-4">{l.value} {l.unit}</td>
                    <td className="py-2 pr-4 text-slate-500">{l.referenceRange} {l.unit}</td>
                    <td className="py-2"><LabFlagBadge flag={l.flag} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Imaging({ patient }: { patient: PatientProfile }) {
  if (!patient.imagingReports.length) return <Card title="Imaging"><p className="text-sm text-slate-500">No imaging reports.</p></Card>;
  return (
    <div className="space-y-4">
      {patient.imagingReports.map((r) => (
        <Card key={r.id} title={`${r.modality} - ${r.bodyPart}`}>
          <p className="mb-3 text-xs text-slate-500">{formatDate(r.performedAt)} · Reported by {r.radiologist}</p>
          <h3 className="text-xs font-semibold uppercase text-slate-500">Findings</h3>
          <p className="mb-3 text-sm">{r.findings}</p>
          <h3 className="text-xs font-semibold uppercase text-slate-500">Impression</h3>
          <p className="text-sm font-medium">{r.impression}</p>
        </Card>
      ))}
    </div>
  );
}

function Medications({ prescriptions }: { prescriptions: Prescription[] }) {
  return (
    <Card title="Medication history">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr><th className="py-2 pr-4">Medication</th><th className="py-2 pr-4">Sig</th><th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Prescriber</th><th className="py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prescriptions.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="py-2 pr-4">
                  <span className="font-medium">{p.drugName}</span> <span className="text-slate-500">{p.dosage}</span>
                  {p.instructions && <span className="block text-xs text-slate-500">{p.instructions}</span>}
                </td>
                <td className="py-2 pr-4">
                  {p.route}, {p.frequency}
                  <span className="block text-xs text-slate-500">
                    {p.quantity ? `Qty ${p.quantity}` : ''}{p.refills ? ` · ${p.refills} refill${p.refills > 1 ? 's' : ''}` : ''}
                  </span>
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                  {formatDate(p.startDate)}{p.endDate ? ` - ${formatDate(p.endDate)}` : ' - ongoing'}
                </td>
                <td className="py-2 pr-4 text-slate-600">Dr. {p.prescribedBy.user.lastName}</td>
                <td className="py-2"><RxStatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
