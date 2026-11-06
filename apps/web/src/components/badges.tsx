const LAB_STYLES = {
  NORMAL: 'bg-emerald-50 text-emerald-700',
  LOW: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-amber-50 text-amber-700',
  CRITICAL: 'bg-rose-50 text-rose-700',
} as const;

const RX_STYLES = {
  ACTIVE: 'bg-teal-50 text-teal-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
  DISCONTINUED: 'bg-rose-50 text-rose-700',
} as const;

export const LabFlagBadge = ({ flag }: { flag: keyof typeof LAB_STYLES }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LAB_STYLES[flag]}`}>{flag}</span>
);

export const RxStatusBadge = ({ status }: { status: keyof typeof RX_STYLES }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RX_STYLES[status]}`}>{status}</span>
);
