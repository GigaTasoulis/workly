export async function onRequest({ request, env }: any) {
  const method = request.method.toUpperCase();

  const ORIGINS = new Set([
    "http://localhost:3000",
    "http://localhost:8788",
    "https://workly-122.pages.dev",
  ]);
  const origin = request.headers.get("origin") || "";
  const cors = (extra: Record<string, string> = {}) => {
    const h: Record<string, string> = { "content-type": "application/json", ...extra };
    if (ORIGINS.has(origin)) {
      h["access-control-allow-origin"] = origin;
      h["access-control-allow-credentials"] = "true";
      h["vary"] = "Origin";
      h["access-control-allow-headers"] = "content-type";
      h["access-control-allow-methods"] = "GET,POST,OPTIONS";
    }
    return h;
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  if (method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id, first_name, last_name, email, phone, position, department,
              hire_date, workplace_id, notes, created_at
       FROM employees
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(user.user_id).all();
    return json({ employees: rows.results ?? [] }, 200, cors());
  }

  if (method === "POST") {
    const b = await safeJson(request);
    const first_name = String(b?.first_name ?? b?.firstName ?? "").trim();
    const last_name  = String(b?.last_name ?? b?.lastName ?? "").trim();
    if (!first_name || !last_name) return json({ error: "first_name and last_name are required" }, 400, cors());

    const email      = String(b?.email ?? "").trim();
    const phone      = String(b?.phone ?? "").trim();
    const position   = String(b?.position ?? "").trim();
    const department = String(b?.department ?? "").trim();
    const hire_date  = String(b?.hire_date ?? b?.hireDate ?? "").trim();
    const workplace_id = String(b?.workplace_id ?? b?.workplaceId ?? "").trim();
    const notes      = String(b?.notes ?? "").trim().slice(0, 2000);

    if (hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(hire_date))
      return json({ error: "hire_date must be YYYY-MM-DD" }, 400, cors());

    if (workplace_id) {
      const wp = await env.DB.prepare(
        `SELECT 1 FROM workplaces WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, workplace_id).first();
      if (!wp) return json({ error: "workplace not found" }, 404, cors());
    }

    const id = crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare(
      `INSERT INTO employees
       (id, user_id, first_name, last_name, email, phone, position, department, hire_date, workplace_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.user_id, first_name, last_name, email, phone, position, department, hire_date || null, workplace_id || null, notes).run();

    return json({
      employee: { id, first_name, last_name, email, phone, position, department, hire_date, workplace_id, notes }
    }, 201, cors());
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function safeJson(req: Request) { try { return await req.json(); } catch { return null; } }
async function getUserFromSession(env: any, request: Request) {
  const m = (request.headers.get("cookie") || "").match(/\bsession=([^;]+)/);
  if (!m) return null;
  const sid = decodeURIComponent(m[1]);
  const now = Math.floor(Date.now() / 1000);
  return await env.DB.prepare(
    `SELECT u.id AS user_id, u.username
     FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(sid, now).first();
}
