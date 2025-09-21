import { compare } from "bcryptjs";

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

export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const isHttps = url.protocol === "https:";

  // Preflight
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
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { username, password } = body || {};
  if (!username || !password) return json({ error: "Missing credentials" }, { status: 400 });

  const row = (await env.DB.prepare("SELECT id, password_hash FROM auth_users WHERE username = ?")
    .bind(username)
    .first()) as { id: string; password_hash: string } | null;

  if (!row) {
    const h = corsHeaders(origin);
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: h,
    });
  }
  const ok = await compare(password, row.password_hash);
  if (!ok) {
    const h = corsHeaders(origin);
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: h,
    });
  }

  const sessionId = crypto.randomUUID();
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  const expiresAt = Math.floor(Date.now() / 1000) + maxAge;

  await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, row.id, expiresAt)
    .run();

  const h = corsHeaders(origin);
  h.set(
    "Set-Cookie",
    cookieHeader("session", sessionId, {
      path: "/",
      maxAge,
      httpOnly: true,
      secure: isHttps, // allow over HTTP in local dev
      sameSite: "Lax",
    }),
  );
  h.set("Content-Type", "application/json");

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
}
