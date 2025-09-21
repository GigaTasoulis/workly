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

function parseCookies(req: Request) {
  const header = req.headers.get("Cookie") || "";
  const pairs = header
    .split(/;\s*/)
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf("=");
      return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))];
    });
  return Object.fromEntries(pairs) as Record<string, string>;
}

async function getUserFromSession(env: any, sid?: string | null) {
  if (!sid) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = (await env.DB.prepare(
    `SELECT u.id, u.username
     FROM auth_sessions s
     JOIN auth_users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(sid, now)
    .first()) as { id: string; username: string } | null;
  return row ?? null;
}

export async function onRequest(context: any) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    const h = corsHeaders(origin);
    h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    h.set("Access-Control-Allow-Headers", "Content-Type");
    h.set("Access-Control-Max-Age", "86400");
    return new Response(null, { status: 204, headers: h });
  }

  const cookies = parseCookies(request);
  const user = await getUserFromSession(env, cookies.session);
  const h = corsHeaders(origin);
  h.set("Content-Type", "application/json");
  if (!user)
    return new Response(JSON.stringify({ authenticated: false }), { status: 401, headers: h });
  return new Response(JSON.stringify({ authenticated: true, user }), { status: 200, headers: h });
}
