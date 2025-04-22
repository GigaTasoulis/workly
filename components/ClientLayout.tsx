// components/ClientLayout.tsx
'use client';

import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const path = usePathname();

  if (!initialized) {
    return null;
  }

  useEffect(() => {
    if (!user && path !== '/login') {
      router.replace('/login');
    } else if (user && path === '/login') {
      router.replace('/');
    }
  }, [user, path, router]);

  return (
    <div className="flex h-screen overflow-hidden">
      {user && <Sidebar />}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900 w-full">
        {children}
      </main>
    </div>
  );
}
