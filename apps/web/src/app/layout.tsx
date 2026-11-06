import type { Metadata } from 'next';
import { AuthProvider } from '@/providers/auth-provider';
import { CallProvider } from '@/providers/call-provider';
import { RealtimeProvider } from '@/providers/realtime-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SKY Clinic',
  description: 'Clinic portal for doctors and patients',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <RealtimeProvider>
            <CallProvider>{children}</CallProvider>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
