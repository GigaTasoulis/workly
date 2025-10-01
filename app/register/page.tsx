"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { user, initialized, register } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uErr, setUErr] = useState("");
  const [pErr, setPErr] = useState("");

  useEffect(() => {
    if (initialized && user) router.replace("/");
  }, [initialized, user, router]);

  const canSubmit = useMemo(() => {
    return username.trim().length >= 3 && password.length >= 8 && password === confirm;
  }, [username, password, confirm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError("");
    setUErr("");
    setPErr("");

    if (!canSubmit) {
      if (username.trim().length < 3) setUErr("At least 3 characters.");
      if (password.length < 8) setPErr("At least 8 characters.");
      if (confirm !== password) setPErr("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await register(username.trim(), password);
      if (!res.ok) {
        const msg = res.error || "Registration failed";

        // map common server messages to field-level errors
        if (/username/i.test(msg) && /exists/i.test(msg)) setUErr("Username already exists.");
        else if (/username/i.test(msg) && /short/i.test(msg)) setUErr("At least 3 characters.");
        else if (/password/i.test(msg) && /short/i.test(msg)) setPErr("At least 8 characters.");
        else if (/password/i.test(msg) && /letters? and numbers?/i.test(msg))
          setPErr("Use letters and numbers.");
        else setError(msg);

        return;
      }

      router.replace("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!initialized) return null;

  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 text-black shadow-lg"
      >
        <h2 className="text-center text-2xl font-semibold text-black">Create your account</h2>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-600">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Username</label>
            <input
              type="text"
              autoComplete="username"
              className="w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
            {uErr && <p className="mt-1 text-xs text-red-600">{uErr}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            {pErr && <p className="mt-1 text-xs text-red-600">{pErr}</p>}
            <p className="mt-1 text-xs text-gray-500">Min 8 chars, letters and numbers.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            disabled={submitting || !canSubmit}
          >
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <a className="text-indigo-600 hover:underline" href="/login">
            Log in
          </a>
        </p>
      </motion.div>
    </div>
  );
}
