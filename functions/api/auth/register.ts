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

async function bumpAndCheckRateLimit(env: any, ip: string, maxPerMinute = 10) {
  await env.DB.exec?.(`CREATE TABLE IF NOT EXISTS auth_rate_limits(
    ip TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ip, bucket)
  )`);

  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 60); // minute bucket

  const row = (await env.DB.prepare(
    "SELECT count FROM auth_rate_limits WHERE ip = ? AND bucket = ?",
  )
    .bind(ip, bucket)
    .first()) as { count: number } | null;

  const current = row?.count ?? 0;
  if (current >= maxPerMinute) return false;

  await env.DB.prepare(
    "INSERT INTO auth_rate_limits(ip,bucket,count) VALUES(?, ?, 1) " +
      "ON CONFLICT(ip,bucket) DO UPDATE SET count = count + 1",
  )
    .bind(ip, bucket)
    .run();

  return true;
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
