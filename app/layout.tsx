import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import AuthProvider from '@/components/AuthProvider';
import ClientLayout from '@/components/ClientLayout';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Work-ly | Διαχείριση Επιχείρησης',
  description: 'Διαχειριστείτε αποτελεσματικά τα δεδομένα της επιχείρησής σας',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
