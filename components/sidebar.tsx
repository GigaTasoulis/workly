"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Users, Briefcase, ShoppingBag, LayoutDashboard, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { translations as t } from "@/lib/translations";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import { ExportDataButton } from "./ExportDataButton";
import { ImportDataButton } from "./ImportDataButton";

type SidebarProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function Sidebar({ isOpen, onOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const ownerId = user?.id ?? "";

  const routes = [
    { name: t.dashboard, path: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
    { name: t.suppliers, path: "/suppliers", icon: <ShoppingBag className="h-5 w-5" /> },
    { name: t.workplaces, path: "/workplaces", icon: <Building2 className="h-5 w-5" /> },
    { name: t.customers, path: "/customers", icon: <Users className="h-5 w-5" /> },
    { name: t.employees, path: "/employees", icon: <Briefcase className="h-5 w-5" /> },
  ];

  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 min-[1100px]:hidden",
          isOpen ? "block" : "hidden",
        )}
        onClick={() => onOpenChange(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r bg-white transition-transform duration-200 ease-in-out dark:bg-gray-950",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "min-[1100px]:static min-[1100px]:w-64 min-[1100px]:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b p-4">
          <Link href="/" className="flex items-center">
            <span className="text-xl font-bold">Work-ly</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="min-[1100px]:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1 p-4">
          {routes.map((route) => {
            const active = pathname === route.path;
            return (
              <Link
                key={route.path}
                href={route.path}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                )}
              >
                {route.icon}
                {route.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <ThemeToggleButton />
        </div>
        <div className="p-4">
          <ExportDataButton ownerId={ownerId} />
        </div>
        <div className="p-4">
          <ImportDataButton ownerId={ownerId} />
        </div>

        <div className="mt-auto p-4">
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await logout();
              } finally {
                localStorage.setItem("theme", "light");
                document.documentElement.classList.remove("dark");
                router.replace("/login/");
                setBusy(false);
              }
            }}
          >
            {busy ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </aside>
    </>
  );
}
