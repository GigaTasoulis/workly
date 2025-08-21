// List/create supplier transactions for the current user
// Supports optional filters: ?supplierId=...&status=pending|paid|cancelled
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
      const url = new URL(request.url);
      const supplierId = (url.searchParams.get("supplierId") || "").trim();
      const status = (url.searchParams.get("status") || "").trim();
  
      const where: string[] = ["user_id = ?"];
      const vals: any[] = [user.user_id];
      if (supplierId) { where.push("supplier_id = ?"); vals.push(supplierId); }
      if (status) {
        if (!["pending","paid","cancelled"].includes(status)) {
          return json({ error: "Invalid status" }, 400, cors());
        }
        where.push("status = ?"); vals.push(status);
      }
  
      const rows = await env.DB.prepare(
        `SELECT id, supplier_id, product_name, amount, amount_paid, date, status, notes, created_at, updated_at
         FROM supplier_transactions
         WHERE ${where.join(" AND ")}
         ORDER BY date DESC, created_at DESC`
      ).bind(...vals).all();
  
      return json({ transactions: rows.results ?? [] }, 200, cors());
    }
  
    if (method === "POST") {
      const body = await safeJson(request);
  
      const supplier_id = String(body?.supplier_id || body?.supplierId || "").trim();
      const product_name = String(body?.product_name || body?.productName || "").trim();
      const amount = Number(body?.amount);
      const amount_paid = Number(body?.amount_paid ?? body?.amountPaid ?? 0);
      const date = String(body?.date || "").trim() || new Date().toISOString().slice(0,10);
      let status = String(body?.status || "pending").trim();
      const notes = String(body?.notes || "").trim().slice(0, 2000);
  
      if (!supplier_id) return json({ error: "supplier_id is required" }, 400, cors());
      if (!product_name) return json({ error: "product_name is required" }, 400, cors());
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "amount must be > 0" }, 400, cors());
      if (!["pending","paid","cancelled"].includes(status)) return json({ error: "Invalid status" }, 400, cors());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());
  
      // Ensure supplier belongs to the user
      const owns = await env.DB.prepare(
        `SELECT 1 FROM suppliers WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, supplier_id).first();
      if (!owns) return json({ error: "Supplier not found" }, 404, cors());
  
      // Auto-flip to paid if fully covered
      if (amount_paid >= amount) status = "paid";
  
      const id = crypto.randomUUID().replace(/-/g, "");
      await env.DB.prepare(
        `INSERT INTO supplier_transactions
         (id, user_id, supplier_id, product_name, amount, amount_paid, date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, user.user_id, supplier_id, product_name, amount, amount_paid, date, status, notes).run();
  
      return json({
        transaction: { id, supplier_id, product_name, amount, amount_paid, date, status, notes }
      }, 201, cors());
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
  