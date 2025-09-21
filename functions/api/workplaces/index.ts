// List/create workplaces for the current user
export async function onRequest({ request, env }: any) {
  const method = request.method.toUpperCase();

  const ORIGINS = new Set([
    "http://localhost:3000",
    "http://localhost:8788",
    "https://workly-122.pages.dev",
  ]);
  const origin = request.headers.get("origin") || "";
  const cors = (extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...extra,
    };
    if (ORIGINS.has(origin)) {
      headers["access-control-allow-origin"] = origin;
      headers["access-control-allow-credentials"] = "true";
      headers["vary"] = "Origin";
      headers["access-control-allow-headers"] = "content-type";
      headers["access-control-allow-methods"] = "GET,POST,OPTIONS";
    }
    return headers;
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  if (method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id, name, address, city, state, zip_code, capacity, notes, created_at
         FROM workplaces
         WHERE user_id = ?
         ORDER BY created_at DESC`,
    )
      .bind(user.user_id)
      .all();

    return json({ workplaces: rows.results ?? [] }, 200, cors());
  }

  if (method === "POST") {
    const body = await safeJson(request);
    const name = String(body?.name || "").trim();
    if (!name) return json({ error: "name is required" }, 400, cors());

    const address = (body?.address ?? "").toString().trim();
    const city = (body?.city ?? "").toString().trim();
    const state = (body?.state ?? "").toString().trim();
    const zip_code = (body?.zip_code ?? body?.zipCode ?? "").toString().trim();
    const capacity = (body?.capacity ?? "").toString().trim();
    const notes = (body?.notes ?? "").toString().trim().slice(0, 2000);

    const id = crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare(
      `INSERT INTO workplaces
         (id, user_id, name, address, city, state, zip_code, capacity, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.user_id, name, address, city, state, zip_code, capacity, notes)
      .run();

    return json(
      {
        workplace: { id, name, address, city, state, zip_code, capacity, notes },
      },
      201,
      cors(),
    );
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
async function getUserFromSession(env: any, request: Request) {
  const m = (request.headers.get("cookie") || "").match(/\bsession=([^;]+)/);
  if (!m) return null;
  const sessionId = decodeURIComponent(m[1]);
  const now = Math.floor(Date.now() / 1000);
  return await env.DB.prepare(
    `SELECT u.id AS user_id, u.username
       FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(sessionId, now)
    .first();
}
