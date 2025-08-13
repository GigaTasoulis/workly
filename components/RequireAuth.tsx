'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    if (!initialized) return;              // wait until we know
    if (!user) {
      // trailing slash since your Next config has trailingSlash: true
      router.replace('/login/');
      return;
    }
    setCanRender(true);                    // show protected content
  }, [initialized, user, router]);

  // Avoid flashing protected HTML before we know auth state
  if (!initialized || !canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
