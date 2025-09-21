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
      `SELECT id, name, contact_person, email, phone, address, afm, tractor, notes, created_at
           FROM customers
          WHERE user_id = ? AND id = ?`,
    )
      .bind(user.user_id, id)
      .first();
    if (!row) return json({ error: "Not found" }, 404, cors());
    return json({ customer: row }, 200, cors());
  }

  if (method === "PUT") {
    const exists = await env.DB.prepare(`SELECT 1 FROM customers WHERE user_id = ? AND id = ?`)
      .bind(user.user_id, id)
      .first();
    if (!exists) return json({ error: "Not found" }, 404, cors());

    const b = await safeJson(request);

    const sets: string[] = [];
    const vals: any[] = [];

    if (b?.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) return json({ error: "name cannot be empty" }, 400, cors());
      sets.push("name = ?");
      vals.push(name);
    }
    if (b?.contact_person !== undefined || b?.contactPerson !== undefined) {
      sets.push("contact_person = ?");
      vals.push((b.contact_person ?? b.contactPerson ?? "").toString().trim() || null);
    }
    if (b?.email !== undefined) {
      sets.push("email = ?");
      vals.push((b.email ?? "").toString().trim() || null);
    }
    if (b?.phone !== undefined) {
      sets.push("phone = ?");
      vals.push((b.phone ?? "").toString().trim() || null);
    }
    if (b?.address !== undefined) {
      sets.push("address = ?");
      vals.push((b.address ?? "").toString().trim() || null);
    }
    if (b?.afm !== undefined) {
      sets.push("afm = ?");
      vals.push((b.afm ?? "").toString().trim() || null);
    }
    if (b?.tractor !== undefined) {
      sets.push("tractor = ?");
      vals.push((b.tractor ?? "").toString().trim() || null);
    }
    if (b?.notes !== undefined) {
      sets.push("notes = ?");
      vals.push((b.notes ?? "").toString().trim().slice(0, 2000) || null);
    }

    if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());

    vals.push(user.user_id, id);
    const res = await env.DB.prepare(
      `UPDATE customers SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`,
    )
      .bind(...vals)
      .run();

    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
    return json({ ok: true }, 200, cors());
  }

  if (method === "DELETE") {
    const res = await env.DB.prepare(`DELETE FROM customers WHERE user_id = ? AND id = ?`)
      .bind(user.user_id, id)
      .run();
    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
    return json({ ok: true }, 200, cors());
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
  const sid = decodeURIComponent(m[1]);
  const now = Math.floor(Date.now() / 1000);
  return await env.DB.prepare(
    `SELECT u.id AS user_id, u.username
         FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(sid, now)
    .first();
}
