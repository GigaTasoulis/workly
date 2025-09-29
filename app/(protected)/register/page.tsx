"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const router = useRouter();

  const [authOrigin, setAuthOrigin] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_API_ORIGIN;
    if (env) setAuthOrigin(env);
    else if (typeof window !== "undefined") {
      const isNextDevOn3000 =
        window.location.hostname === "localhost" && window.location.port === "3000";
      setAuthOrigin(isNextDevOn3000 ? "http://localhost:8788" : window.location.origin);
    }
  }, []);

  const endpoint = useMemo(() => {
    if (!authOrigin) return "#";
    return `${authOrigin}/api/auth/register`;
  }, [authOrigin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Registration failed");
        return;
      }

      // Auto-logged-in by the API; go home
      router.replace("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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

        <form onSubmit={submit} className="space-y-4">
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
            disabled={submitting || !authOrigin}
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our Terms & Privacy Policy.
        </p>

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
