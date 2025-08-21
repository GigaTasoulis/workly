// Update and delete a supplier owned by the current user
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
        headers["access-control-allow-methods"] = "PUT,DELETE,OPTIONS";
      }
      return headers;
    };
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (!id) return json({ error: "Missing id" }, 400, cors());
  
    const user = await getUserFromSession(env, request);
    if (!user) return json({ error: "Unauthorized" }, 401, cors());
  
    if (method === "PUT") {
      const body = await safeJson(request);
  
      const sets: string[] = [];
      const vals: any[] = [];
  
      const map: Record<string, any> = {
        name: body?.name,
        contact_person: body?.contact_person ?? body?.contactPerson,
        email: body?.email,
        phone: body?.phone,
        address: body?.address,
        notes: body?.notes,
      };
  
      for (const [col, val] of Object.entries(map)) {
        if (val !== undefined) {
          sets.push(`${col} = ?`);
          vals.push(String(val).trim());
        }
      }
      if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());
  
      vals.push(user.user_id, id);
      try {
        const res = await env.DB.prepare(
          `UPDATE suppliers SET ${sets.join(", ")}
           WHERE user_id = ? AND id = ?`
        ).bind(...vals).run();
  
        if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
      } catch (e: any) {
        if (String(e?.message || "").includes("idx_suppliers_user_name")) {
          return json({ error: "Supplier name already exists" }, 409, cors());
        }
        return json({ error: "Update failed" }, 500, cors());
      }
  
      return json({ ok: true }, 200, cors());
    }
  
    if (method === "DELETE") {
      const res = await env.DB.prepare(
        `DELETE FROM suppliers WHERE user_id = ? AND id = ?`
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
  