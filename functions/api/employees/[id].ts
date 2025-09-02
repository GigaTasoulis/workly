export async function onRequest({ request, env, params }: any) {
  const method = request.method.toUpperCase();
  const id = String(params?.id || "").trim();

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
      h["access-control-allow-methods"] = "GET,PUT,DELETE,OPTIONS";
    }
    return h;
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (!id) return json({ error: "Missing id" }, 400, cors());

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  if (method === "GET") {
    const row = await env.DB.prepare(
      `SELECT id, first_name, last_name, email, phone, position, department,
              hire_date, workplace_id, notes, created_at
       FROM employees WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, id).first();
    if (!row) return json({ error: "Not found" }, 404, cors());
    return json({ employee: row }, 200, cors());
  }

  if (method === "PUT") {
    const existing = await env.DB.prepare(
      `SELECT id FROM employees WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, id).first();
    if (!existing) return json({ error: "Not found" }, 404, cors());

    const b = await safeJson(request);
    const sets: string[] = [];
    const vals: any[] = [];

    if (b?.first_name !== undefined || b?.firstName !== undefined) {
      const v = String(b.first_name ?? b.firstName).trim();
      if (!v) return json({ error: "first_name cannot be empty" }, 400, cors());
      sets.push("first_name = ?"); vals.push(v);
    }
    if (b?.last_name !== undefined || b?.lastName !== undefined) {
      const v = String(b.last_name ?? b.lastName).trim();
      if (!v) return json({ error: "last_name cannot be empty" }, 400, cors());
      sets.push("last_name = ?"); vals.push(v);
    }
    if (b?.email !== undefined)      { sets.push("email = ?");      vals.push(String(b.email).trim()); }
    if (b?.phone !== undefined)      { sets.push("phone = ?");      vals.push(String(b.phone).trim()); }
    if (b?.position !== undefined)   { sets.push("position = ?");   vals.push(String(b.position).trim()); }
    if (b?.department !== undefined) { sets.push("department = ?"); vals.push(String(b.department).trim()); }

    if (b?.hire_date !== undefined || b?.hireDate !== undefined) {
      const d = String(b.hire_date ?? b.hireDate).trim();
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: "hire_date must be YYYY-MM-DD" }, 400, cors());
      sets.push("hire_date = ?"); vals.push(d || null);
    }

    if (b?.workplace_id !== undefined || b?.workplaceId !== undefined) {
      const wp = String(b.workplace_id ?? b.workplaceId ?? "").trim();
      if (wp) {
        const owns = await env.DB.prepare(
          `SELECT 1 FROM workplaces WHERE user_id = ? AND id = ?`
        ).bind(user.user_id, wp).first();
        if (!owns) return json({ error: "workplace not found" }, 404, cors());
        sets.push("workplace_id = ?"); vals.push(wp);
      } else {
        sets.push("workplace_id = ?"); vals.push(null);
      }
    }

    if (sets.length === 0 && b?.notes === undefined)
      return json({ error: "No fields to update" }, 400, cors());

    if (b?.notes !== undefined) { sets.push("notes = ?"); vals.push(String(b.notes).toString().trim().slice(0, 2000)); }

    vals.push(user.user_id, id);
    const res = await env.DB.prepare(
      `UPDATE employees SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`
    ).bind(...vals).run();

    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
    return json({ ok: true }, 200, cors());
  }

  if (method === "DELETE") {
    const res = await env.DB.prepare(
      `DELETE FROM employees WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, id).run();
    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
    return json({ ok: true }, 200, cors());
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
