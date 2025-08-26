// Get/update/delete a workplace owned by the current user
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
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...extra,
      };
      if (ORIGINS.has(origin)) {
        headers["access-control-allow-origin"] = origin;
        headers["access-control-allow-credentials"] = "true";
        headers["vary"] = "Origin";
        headers["access-control-allow-headers"] = "content-type";
        headers["access-control-allow-methods"] = "GET,PUT,DELETE,OPTIONS";
      }
      return headers;
    };
  
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (!id) return json({ error: "Missing id" }, 400, cors());
  
    const user = await getUserFromSession(env, request);
    if (!user) return json({ error: "Unauthorized" }, 401, cors());
  
    if (method === "GET") {
      const row = await env.DB.prepare(
        `SELECT id, name, address, city, state, zip_code, capacity, notes, created_at
         FROM workplaces
         WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, id).first();
  
      if (!row) return json({ error: "Not found" }, 404, cors());
      return json({ workplace: row }, 200, cors());
    }
  
    if (method === "PUT") {
      const body = await safeJson(request);
  
      // Confirm ownership exists first (and allows 404 if not found)
      const existing = await env.DB.prepare(
        `SELECT id FROM workplaces WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, id).first();
      if (!existing) return json({ error: "Not found" }, 404, cors());
  
      const sets: string[] = [];
      const vals: any[] = [];
  
      if (body?.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) return json({ error: "name cannot be empty" }, 400, cors());
        sets.push("name = ?");
        vals.push(name);
      }
      if (body?.address !== undefined) { sets.push("address = ?"); vals.push(String(body.address).trim()); }
      if (body?.city !== undefined)    { sets.push("city = ?");    vals.push(String(body.city).trim()); }
      if (body?.state !== undefined)   { sets.push("state = ?");   vals.push(String(body.state).trim()); }
      if (body?.zip_code !== undefined || body?.zipCode !== undefined) {
        sets.push("zip_code = ?");
        vals.push(String(body.zip_code ?? body.zipCode).trim());
      }
      if (body?.capacity !== undefined){ sets.push("capacity = ?"); vals.push(String(body.capacity).trim()); }
      if (body?.notes !== undefined)   { sets.push("notes = ?");    vals.push(String(body.notes).toString().trim().slice(0, 2000)); }
  
      if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());
  
      vals.push(user.user_id, id);
      const res = await env.DB.prepare(
        `UPDATE workplaces SET ${sets.join(", ")}
         WHERE user_id = ? AND id = ?`
      ).bind(...vals).run();
  
      if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
      return json({ ok: true }, 200, cors());
    }
  
    if (method === "DELETE") {
      const res = await env.DB.prepare(
        `DELETE FROM workplaces WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, id).run();
  
      if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
      return json({ ok: true }, 200, cors());
    }
  
    return json({ error: "Method not allowed" }, 405, cors());
  }
  
  function json(data: any, status = 200, headers?: Record<string, string>) {
    return new Response(JSON.stringify(data), { status, headers });
  }
  async function safeJson(req: Request) {
    try { return await req.json(); } catch { return null; }
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
       WHERE s.id = ? AND s.expires_at > ?`
    ).bind(sessionId, now).first();
  }
  