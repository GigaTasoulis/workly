'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import ThemeToggleButton from '@/components/ThemeToggleButton';

function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  // Visible only under 1100px
  return (
    <div className="min-[1100px]:hidden sticky top-0 z-40 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="outline" size="icon" onClick={onMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold">Work-ly</span>
        <ThemeToggleButton />
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!initialized) return;
    if (!user && path !== '/login') router.replace('/login');
    else if (user && path === '/login') router.replace('/');
  }, [user, path, router, initialized]);

  if (!initialized) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {user && <Sidebar isOpen={sidebarOpen} onOpenChange={setSidebarOpen} />}

      <div className="flex-1 flex flex-col min-w-0 min-[1100px]:pl-64">
        {user && <MobileTopBar onMenu={() => setSidebarOpen(true)} />}
        <main className="flex-1 overflow-y-auto p-4 min-[1100px]:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
