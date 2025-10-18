"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import ThemeToggleButton from "@/components/ThemeToggleButton";

function MobileTopBar({ onMenu, userId }: { onMenu: () => void; userId?: string }) {
  return (
    <div className="sticky top-0 z-40 border-b bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 dark:bg-gray-900/80 min-[1100px]:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="outline" size="icon" onClick={onMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold">Work-ly</span>
        <ThemeToggleButton userId={userId} />
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  console.log("ClientLayout mount", { path, initialized, hasUser: !!user });

  // inside your existing useEffect, just before each router.replace:
  useEffect(() => {
    if (!initialized) return;

    // normalize trailing slash: "/register/" -> "/register"
    const p = path && path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path || "/";
    const isPublic = p === "/login" || p === "/register";

    // debug so we can see what the guard decides
    console.log("auth-guard", {
      rawPath: path,
      normalized: p,
      initialized,
      hasUser: !!user,
      isPublic,
    });

    if (!user) {
      if (!isPublic) {
        router.replace("/login");
      }
      return; // ✅ never redirect off /login or /register
    }

    if (isPublic && p !== "/") {
      router.replace("/");
    }
  }, [initialized, user, path, router]);

  if (!initialized) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {user && <Sidebar isOpen={sidebarOpen} onOpenChange={setSidebarOpen} />}

      <div className="flex min-w-0 flex-1 flex-col">
        {user && <MobileTopBar userId={user.id} onMenu={() => setSidebarOpen(true)} />}
        <main className="flex-1 overflow-y-auto p-4 min-[1100px]:p-6">{children}</main>
      </div>
    </div>
  );
}
