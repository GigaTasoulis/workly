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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders(origin),
    });
  }

  const cookies = parseCookies(request);
  const sid = cookies.session;
  if (sid) {
    await env.DB.prepare("DELETE FROM auth_sessions WHERE id = ?").bind(sid).run();
  }

  const h = corsHeaders(origin);
  h.set(
    "Set-Cookie",
    cookieHeader("session", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: isHttps,
      sameSite: "Lax",
    }),
  );
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
}
