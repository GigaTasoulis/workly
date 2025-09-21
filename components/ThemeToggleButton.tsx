"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const MoonIcon = dynamic(() => import("lucide-react").then((mod) => mod.Moon), {
  ssr: false,
});
const SunIcon = dynamic(() => import("lucide-react").then((mod) => mod.Sun), {
  ssr: false,
});

export default function ThemeToggleButton() {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "light";
    }
    return "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center rounded-md p-2 hover:bg-gray-200 dark:hover:bg-gray-800"
    >
      {theme === "light" ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
    </button>
  );
}
