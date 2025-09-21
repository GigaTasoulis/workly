"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, initialized } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialized && user) router.replace("/");
  }, [initialized, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const ok = await login(username, password);
    if (ok) {
      router.replace("/"); // go to home/dashboard
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="flex h-full items-center justify-center">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 text-black shadow-lg"
      >
        <h2 className="text-center text-2xl font-semibold text-black dark:text-black">
          Welcome Back
        </h2>

        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        <div className="space-y-2">
          <label className="block text-sm font-medium">Username</label>
          <input
            type="text"
            className="w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            className="w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white transition hover:bg-indigo-700"
        >
          Log in
        </button>
      </motion.form>
    </div>
  );
}
