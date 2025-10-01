"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { motion } from "framer-motion";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.6 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.5 6.3 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.5 6.3 29.6 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.3C29.1 35.6 26.7 36 24 36c-5.3 0-9.6-3.4-11.3-8.1l-6.6 5.1C9.1 39.4 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.2 5.3C37.8 38.9 40 33 40 26c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user, initialized } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Decide which origin hosts your OAuth endpoints:
  // - Local dev: http://localhost:8788 (wrangler pages dev)
  // - Preview/Prod: same origin as the site
  const [authOrigin, setAuthOrigin] = useState<string>("");

  useEffect(() => {
    // Compute on client to avoid SSR mismatch
    const env = process.env.NEXT_PUBLIC_API_ORIGIN;
    if (env) {
      setAuthOrigin(env);
    } else if (typeof window !== "undefined") {
      const isNextDevOn3000 =
        window.location.hostname === "localhost" && window.location.port === "3000";
      setAuthOrigin(isNextDevOn3000 ? "http://localhost:8788" : window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (initialized && user) router.replace("/");
  }, [initialized, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const ok = await login(username, password);
      if (ok) router.replace("/");
      else setError("Invalid credentials");
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const googleHref = useMemo(() => {
    if (!authOrigin) return "#";
    // Optional: include a return URL so your callback can redirect you back to where you started
    const returnTo = typeof window !== "undefined" ? window.location.origin : "";
    const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    return `${authOrigin}/api/auth/google/start${qs}`;
  }, [authOrigin]);

  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 text-black shadow-lg"
      >
        <h2 className="text-center text-2xl font-semibold text-black">Welcome Back</h2>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-600">{error}</p>
        )}

        {/* Google SSO */}
        <a
          href={googleHref}
          className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium transition hover:bg-gray-50 disabled:opacity-50"
          aria-disabled={!authOrigin}
          onClick={(e) => {
            if (!authOrigin) e.preventDefault();
          }}
        >
          <GoogleIcon />
          Continue with Google
        </a>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs uppercase text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Username / Password form */}
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
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        {/* Small helper text */}
        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our Terms & Privacy Policy.
        </p>
        <p className="text-center text-sm text-gray-600">
          Don’t have an account?{" "}
          <a className="text-indigo-600 hover:underline" href="/register">
            Create one
          </a>
        </p>
      </motion.div>
    </div>
  );
}
