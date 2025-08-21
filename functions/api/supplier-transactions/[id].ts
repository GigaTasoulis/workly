// Update and delete a supplier transaction owned by the current user
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
  
      // Load existing row (confirm ownership)
      const existing = await env.DB.prepare(
        `SELECT id, supplier_id, amount, amount_paid FROM supplier_transactions
         WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, id).first();
      if (!existing) return json({ error: "Not found" }, 404, cors());
  
      // Build dynamic updates
      const sets: string[] = [];
      const vals: any[] = [];
  
      if (body?.product_name !== undefined || body?.productName !== undefined) {
        sets.push("product_name = ?");
        vals.push(String(body.product_name ?? body.productName).trim());
      }
      if (body?.amount !== undefined) {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) return json({ error: "amount must be > 0" }, 400, cors());
        sets.push("amount = ?");
        vals.push(amount);
      }
      if (body?.amount_paid !== undefined || body?.amountPaid !== undefined) {
        const v = Number(body.amount_paid ?? body.amountPaid);
        if (!Number.isFinite(v) || v < 0) return json({ error: "amount_paid must be >= 0" }, 400, cors());
        sets.push("amount_paid = ?");
        vals.push(v);
      }
      if (body?.date !== undefined) {
        const date = String(body.date).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());
        sets.push("date = ?");
        vals.push(date);
      }
      if (body?.status !== undefined) {
        const status = String(body.status).trim();
        if (!["pending","paid","cancelled"].includes(status)) return json({ error: "Invalid status" }, 400, cors());
        sets.push("status = ?");
        vals.push(status);
      }
      if (body?.notes !== undefined) {
        sets.push("notes = ?");
        vals.push(String(body.notes).trim().slice(0, 2000));
      }
  
      // If amount/amount_paid changed (or status omitted), recompute status server-side
      let finalStatus: string | undefined;
      let newAmount = ("amount" in body) ? Number(body.amount) : existing.amount;
      let newPaid   = ("amount_paid" in body || "amountPaid" in body) ? Number(body.amount_paid ?? body.amountPaid) : existing.amount_paid;
      if (Number.isFinite(newAmount) && Number.isFinite(newPaid)) {
        if (!("status" in body)) {
          finalStatus = newPaid >= newAmount ? "paid" : undefined;
        }
      }
      if (finalStatus) {
        sets.push("status = ?");
        vals.push(finalStatus);
      }
  
      if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());
  
      vals.push(user.user_id, id);
      const res = await env.DB.prepare(
        `UPDATE supplier_transactions SET ${sets.join(", ")}
         WHERE user_id = ? AND id = ?`
      ).bind(...vals).run();
  
      if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
      return json({ ok: true }, 200, cors());
    }
  
    if (method === "DELETE") {
      const res = await env.DB.prepare(
        `DELETE FROM supplier_transactions WHERE user_id = ? AND id = ?`
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
  