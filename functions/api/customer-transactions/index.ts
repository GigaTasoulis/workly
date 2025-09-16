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

  // choose table (prefer customer_transactions)
  const txTable = (await hasTable(env, "customer_transactions"))
    ? "customer_transactions"
    : (await hasTable(env, "transactions")) ? "transactions" : null;
  if (!txTable) return json({ error: "Transactions table missing" }, 500, cors());

  if (method === "GET") {
    const url = new URL(request.url);
    const customer_id = (url.searchParams.get("customer_id") || url.searchParams.get("customerId") || "").trim();
    if (!customer_id) return json({ error: "customer_id is required" }, 400, cors());

    const rows = await env.DB.prepare(
      `SELECT id, customer_id, product_name, amount, amount_paid, date, status, notes, created_at
         FROM ${txTable}
        WHERE user_id = ? AND customer_id = ?
        ORDER BY date DESC, created_at DESC`
    ).bind(user.user_id, customer_id).all();

    return json({ transactions: rows.results ?? [] }, 200, cors());
  }

  if (method === "POST") {
    const b = await safeJson(request);
    const customer_id  = String(b?.customer_id ?? "").trim();
    const product_name = String(b?.product_name ?? "").trim();
    const amount       = Number(b?.amount ?? 0) || 0;
    const amount_paid  = Number(b?.amount_paid ?? 0) || 0;
    const date         = String(b?.date ?? "").trim() || new Date().toISOString().slice(0,10);
    const status       = (String(b?.status ?? "pending").trim() || "pending") as "paid"|"pending"|"cancelled";
    const notes        = (b?.notes ?? "").toString().trim() || null;

    if (!customer_id)  return json({ error: "customer_id is required" }, 400, cors());
    if (!product_name) return json({ error: "product_name is required" }, 400, cors());
    if (amount <= 0)   return json({ error: "amount must be > 0" }, 400, cors());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());

    const owns = await env.DB.prepare(
      `SELECT 1 FROM customers WHERE id = ? AND user_id = ?`
    ).bind(customer_id, user.user_id).first();
    if (!owns) return json({ error: "customer not found" }, 404, cors());

    const id = crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare(
      `INSERT INTO ${txTable}
         (id, user_id, customer_id, product_name, amount, amount_paid, date, status, notes)
       VALUES (?,  ?,      ?,          ?,            ?,      ?,           ?,    ?,      ?)`
    ).bind(id, user.user_id, customer_id, product_name, amount, amount_paid, date, status, notes).run();

    return json({ ok: true, transaction: { id } }, 201, cors());
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

/* helpers */
function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function safeJson(req: Request) { try { return await req.json(); } catch { return null; } }
async function hasTable(env: any, name: string) {
  const r = await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();
  return !!r;
}
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
