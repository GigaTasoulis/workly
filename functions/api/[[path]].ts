// functions/api/auth/[[path]].ts
// Minimal, safe auth routes for Cloudflare Pages + D1.
//
// Routes:
//   POST /api/auth/login   -> { username, password }  (sets HttpOnly cookie)
//   GET  /api/auth/me      -> returns { authenticated, user? }
//   POST /api/auth/logout  -> clears session + cookie
//
// NOTE: There's also an optional /register at the bottom we'll use ONCE to seed a user,
// then you should remove/disable it.

import { compare, hash } from "bcryptjs";

// ---- helpers ----

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
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
  } = {}
) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

function parseCookies(req: Request) {
  const header = req.headers.get("Cookie") || "";
  if (!header) return {} as Record<string, string>;
  const entries = header.split(/;\s*/).filter(Boolean).map((kv) => {
    const i = kv.indexOf("=");
    return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))];
  });
  return Object.fromEntries(entries) as Record<string, string>;
}

async function getUserFromSession(env: any, sessionId?: string | null) {
  if (!sessionId) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT u.id, u.username
     FROM auth_sessions s JOIN auth_users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(sessionId, now).first() as { id: string; username: string } | null;
  return row ?? null;
}

// ---- main handler ----

export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname; // e.g. /api/auth/login

  // GET /api/auth/me
  if (request.method === "GET" && pathname.endsWith("/me")) {
    const cookies = parseCookies(request);
    const user = await getUserFromSession(env, cookies.session);
    if (!user) return json({ authenticated: false }, { status: 401 });
    return json({ authenticated: true, user });
  }

  // POST /api/auth/login
  if (request.method === "POST" && pathname.endsWith("/login")) {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { username, password } = body || {};
    if (!username || !password) return json({ error: "Missing credentials" }, { status: 400 });

    const row = await env.DB.prepare(
      "SELECT id, password_hash FROM auth_users WHERE username = ?"
    ).bind(username).first() as { id: string; password_hash: string } | null;

    if (!row) return json({ error: "Invalid credentials" }, { status: 401 });

    const ok = await compare(password, row.password_hash);
    if (!ok) return json({ error: "Invalid credentials" }, { status: 401 });

    const sessionId = crypto.randomUUID();
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    const expiresAt = Math.floor(Date.now() / 1000) + maxAge;

    await env.DB.prepare(
      "INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionId, row.id, expiresAt).run();

    return json({ ok: true }, {
      headers: {
        "Set-Cookie": cookieHeader("session", sessionId, {
          path: "/",
          maxAge,
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        }),
      },
    });
  }

  // POST /api/auth/logout
  if (request.method === "POST" && pathname.endsWith("/logout")) {
    const cookies = parseCookies(request);
    const sid = cookies.session;
    if (sid) {
      await env.DB.prepare("DELETE FROM auth_sessions WHERE id = ?").bind(sid).run();
    }
    return json({ ok: true }, {
      headers: {
        "Set-Cookie": cookieHeader("session", "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        }),
      },
    });
  }

  // OPTIONAL: POST /api/auth/register — use once to seed a user, then remove/disable.
  if (request.method === "POST" && pathname.endsWith("/register")) {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { username, password } = body || {};
    if (!username || !password) return json({ error: "Missing fields" }, { status: 400 });

    const exists = await env.DB.prepare("SELECT 1 FROM auth_users WHERE username = ?").bind(username).first();
    if (exists) return json({ error: "Username already exists" }, { status: 409 });

    const password_hash = await hash(password, 10);
    const id = crypto.randomUUID();

    await env.DB.prepare(
      "INSERT INTO auth_users (id, username, password_hash) VALUES (?, ?, ?)"
    ).bind(id, username, password_hash).run();

    return json({ ok: true, id, username }, { status: 201 });
  }

  return json({ error: "Not found" }, { status: 404 });
}
