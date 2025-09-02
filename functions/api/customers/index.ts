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
        `SELECT id, name, contact_person, email, phone, address, afm, tractor, notes, created_at
           FROM customers
          WHERE user_id = ?
          ORDER BY created_at DESC`
      ).bind(user.user_id).all();
      return json({ customers: rows.results ?? [] }, 200, cors());
    }
  
    if (method === "POST") {
      const b = await safeJson(request);
  
      const name           = String(b?.name ?? "").trim();
      const contact_person = (b?.contact_person ?? b?.contactPerson ?? "").toString().trim() || null;
      const email          = (b?.email ?? "").toString().trim() || null;
      const phone          = (b?.phone ?? "").toString().trim() || null;
      const address        = (b?.address ?? "").toString().trim() || null;
      const afm            = (b?.afm ?? "").toString().trim() || null;
      const tractor        = (b?.tractor ?? "").toString().trim() || null;
      const notes          = (b?.notes ?? "").toString().trim().slice(0, 2000) || null;
  
      if (!name) return json({ error: "name is required" }, 400, cors());
  
      const id = crypto.randomUUID().replace(/-/g, "");
      await env.DB.prepare(
        `INSERT INTO customers
           (id, user_id, name, contact_person, email, phone, address, afm, tractor, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, user.user_id, name, contact_person, email, phone, address, afm, tractor, notes).run();
  
      return json({
        customer: { id, name, contact_person, email, phone, address, afm, tractor, notes }
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
  