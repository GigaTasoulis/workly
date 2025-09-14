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
        `SELECT id, customer_id, product_name, amount, amount_paid, date, status, notes, created_at
           FROM customer_transactions
          WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, id).first();
      if (!row) return json({ error: "Not found" }, 404, cors());
      return json({ transaction: row }, 200, cors());
    }
  
    if (method === "PUT") {
      const exists = await env.DB.prepare(
        `SELECT 1 FROM customer_transactions WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, id).first();
      if (!exists) return json({ error: "Not found" }, 404, cors());
  
      const b = await safeJson(request);
      const sets: string[] = [];
      const vals: any[] = [];
  
      if (b?.customer_id !== undefined) { sets.push("customer_id = ?"); vals.push(String(b.customer_id).trim()); }
      if (b?.product_name !== undefined) { sets.push("product_name = ?"); vals.push(String(b.product_name).trim()); }
      if (b?.amount !== undefined)       { sets.push("amount = ?");       vals.push(Number(b.amount) || 0); }
      if (b?.amount_paid !== undefined)  { sets.push("amount_paid = ?");  vals.push(Number(b.amount_paid) || 0); }
      if (b?.date !== undefined)         { sets.push("date = ?");         vals.push((String(b.date).trim() || null)); }
      if (b?.status !== undefined)       { sets.push("status = ?");       vals.push(String(b.status).trim()); }
      if (b?.notes !== undefined)        { sets.push("notes = ?");        vals.push((b.notes ?? "").toString().trim().slice(0, 2000) || null); }
  
      if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());
  
      vals.push(user.user_id, id);
      await env.DB.prepare(
        `UPDATE customer_transactions SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`
      ).bind(...vals).run();
  
      return json({ ok: true }, 200, cors());
    }
  
    if (method === "DELETE") {
      const res = await env.DB.prepare(
        `DELETE FROM customer_transactions WHERE user_id = ? AND id = ?`
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
  