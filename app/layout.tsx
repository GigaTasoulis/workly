import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SWRegister from './sw-register';

import AuthProvider from '@/components/AuthProvider';
import ClientLayout from '@/components/ClientLayout';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Work-ly | Διαχείριση Επιχείρισης',
  description: 'Διαχειριστείτε αποτελεσματικά τα δεδομένα της επιχείρησής σας',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0ea5e9" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
        <Toaster />
        {/* register the service worker after page load */}
        <SWRegister />
      </body>
    </html>
  );
}
