import { AppShell } from '@/components/app-shell';

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="DOCTOR">{children}</AppShell>;
}
