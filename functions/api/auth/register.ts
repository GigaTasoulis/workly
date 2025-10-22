import { hash } from "bcryptjs";

/* ---------- helpers ---------- */
function json(data: unknown, init: ResponseInit = {}) {
  const h = new Headers(init.headers || {});
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers: h });
}

function cookieHeader(
  name: string,
  value: string,
  opts: {
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
  } = {},
) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

const ALLOWED = new Set([
  "http://localhost:3000",
  "http://localhost:8788",
  "https://workly-122.pages.dev",
]);

function corsHeaders(origin: string | null) {
  const h = new Headers();
  if (origin && ALLOWED.has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Vary", "Origin");
  }
  return h;
}

// --- KV-based rate limiting helpers ---
function ipFrom(req: Request) {
  const h = req.headers;
  const ip =
    h.get("CF-Connecting-IP") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "";
  return ip || "unknown";
}

type KV = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
};

async function kvWindowLimit(
  kv: KV,
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / windowSec);
  const storageKey = `rl:${key}:${bucket}`;
  const v = await kv.get(storageKey);
  const count = v ? parseInt(v, 10) || 0 : 0;

  if (count >= limit) {
    const resetAt = (bucket + 1) * windowSec;
    return { ok: false, retryAfterSec: Math.max(1, resetAt - nowSec) };
  }

  await kv.put(storageKey, String(count + 1), { expirationTtl: windowSec + 5 });
  return { ok: true, retryAfterSec: 0 };
}

/* ------------------------------ handler ------------------------------ */
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const isHttps = url.protocol === "https:";

  try {
    // CORS preflight
    if (request.method === "OPTIONS") {
      const h = corsHeaders(origin);
      h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      h.set("Access-Control-Allow-Headers", "Content-Type");
      h.set("Access-Control-Max-Age", "86400");
      return new Response(null, { status: 204, headers: h });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // ---- KV rate limit: 2/min AND 5/hour per IP on register ----
    const ip = ipFrom(request);
    const kv: KV | undefined = env.RATELIMIT;
    if (kv) {
      const minute = await kvWindowLimit(kv, `register:${ip}:m`, 2, 60);
      if (!minute.ok) {
        const h2 = corsHeaders(origin);
        h2.set("Retry-After", String(minute.retryAfterSec));
        h2.set("Content-Type", "application/json");
        return new Response(
          JSON.stringify({ error: "rate_limited", retryAfter: minute.retryAfterSec }),
          { status: 429, headers: h2 },
        );
      }
      const hour = await kvWindowLimit(kv, `register:${ip}:h`, 5, 3600);
      if (!hour.ok) {
        const h2 = corsHeaders(origin);
        h2.set("Retry-After", String(hour.retryAfterSec));
        h2.set("Content-Type", "application/json");
        return new Response(
          JSON.stringify({ error: "rate_limited", retryAfter: hour.retryAfterSec }),
          { status: 429, headers: h2 },
        );
      }
    } else {
      // Optional: keep or remove this log
      console.warn("RATELIMIT KV not bound; skipping register limiter");
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      const h = corsHeaders(origin);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: h,
      });
    }

    const { username, password } = body || {};
    const h = corsHeaders(origin);

    // Basic validation
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: h,
      });
    }
    if (typeof username !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: h,
      });
    }
    if (username.length < 3) {
      return new Response(JSON.stringify({ error: "Username too short" }), {
        status: 400,
        headers: h,
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password too short" }), {
        status: 400,
        headers: h,
      });
    }

    // Uniqueness check
    const exists = (await env.DB.prepare("SELECT 1 FROM auth_users WHERE username = ? LIMIT 1")
      .bind(username)
      .first()) as { 1: number } | null;

    if (exists) {
      return new Response(JSON.stringify({ error: "Username already exists" }), {
        status: 409,
        headers: h,
      });
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Generate our own user id to avoid any default/id lookup issues
    const userId = crypto.randomUUID();

    // Create user with explicit id
    await env.DB.prepare("INSERT INTO auth_users (id, username, password_hash) VALUES (?, ?, ?)")
      .bind(userId, username, passwordHash)
      .run();

    // Create session for that id
    const sessionId = crypto.randomUUID();
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    const expiresAt = Math.floor(Date.now() / 1000) + maxAge;

    await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(sessionId, userId, expiresAt)
      .run();

    h.set(
      "Set-Cookie",
      cookieHeader("session", sessionId, {
        path: "/",
        maxAge,
        httpOnly: true,
        secure: isHttps,
        sameSite: "Lax",
      }),
    );
    h.set("Content-Type", "application/json");

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: h,
    });
  } catch (err: any) {
    console.error("register:unhandled", err);
    const h = corsHeaders(request.headers.get("Origin"));
    h.set("Content-Type", "application/json");
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err?.message || err) }),
      { status: 500, headers: h },
    );
  }
}
