"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const MoonIcon = dynamic(() => import("lucide-react").then((m) => m.Moon), { ssr: false });
const SunIcon = dynamic(() => import("lucide-react").then((m) => m.Sun), { ssr: false });

type Props = { userId?: string };

export default function ThemeToggleButton({ userId }: Props) {
  const storageKey = useMemo(() => (userId ? `theme:${userId}` : "theme:anon"), [userId]);

  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(storageKey) || "light";
  });

  useEffect(() => {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(storageKey, theme);

    document.cookie = `theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [theme, storageKey]);

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="flex items-center justify-center rounded-md p-2 hover:bg-gray-200 dark:hover:bg-gray-800"
      aria-label="Toggle theme"
    >
      {theme === "light" ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
    </button>
  );
}
