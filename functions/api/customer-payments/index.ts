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

  // Use whichever tx table exists
  const txTable = (await hasTable(env, "customer_transactions"))
    ? "customer_transactions"
    : (await hasTable(env, "transactions")) ? "transactions" : null;
  if (!txTable) return json({ error: "Transactions table missing" }, 500, cors());

  // Ensure payments table exists with YOUR schema (0011)
  await ensurePaymentsTable(env);

  if (method === "GET") {
    const url = new URL(request.url);
    const customer_id = (url.searchParams.get("customer_id") || url.searchParams.get("customerId") || "").trim();
    const limit = Math.max(0, Number(url.searchParams.get("limit") || 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
    if (!customer_id) return json({ error: "customer_id is required" }, 400, cors());

    const totalRow = await env.DB.prepare(
      `SELECT COUNT(*) AS c
         FROM customer_payments
        WHERE user_id = ? AND customer_id = ?`
    ).bind(user.user_id, customer_id).first();
    const total = Number(totalRow?.c || 0);

    // Alias payment_amount/payment_date to amount/date so the UI doesn't change
    const rows = await env.DB.prepare(
      `SELECT
          id,
          user_id,
          transaction_id,
          customer_id,
          product_name,
          payment_amount AS amount,
          payment_date   AS date,
          notes,
          created_at
         FROM customer_payments
        WHERE user_id = ? AND customer_id = ?
        ORDER BY payment_date DESC, created_at DESC
        LIMIT ? OFFSET ?`
    ).bind(user.user_id, customer_id, limit, offset).all();

    return json({ payments: rows.results ?? [], total }, 200, cors());
  }

  if (method === "POST") {
    const b = await safeJson(request);
    const transaction_id = String(b?.transaction_id ?? "").trim();
    const payAmount      = Number(b?.amount ?? 0) || 0;  // body uses "amount", we store "payment_amount"
    const payDate        = String(b?.date ?? "").trim() || new Date().toISOString().slice(0,10); // -> payment_date
    const notes          = (b?.notes ?? "").toString().trim() || null;

    if (!transaction_id) return json({ error: "transaction_id is required" }, 400, cors());
    if (payAmount <= 0)  return json({ error: "amount must be > 0" }, 400, cors());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());

    // Load linked tx: we need amount, amount_paid, status, customer_id and maybe product_name
    const tx = await env.DB.prepare(
      `SELECT id, user_id, customer_id, amount, amount_paid, status, product_name
         FROM ${txTable}
        WHERE id = ? AND user_id = ?`
    ).bind(transaction_id, user.user_id).first();

    if (!tx) return json({ error: "Not found: transaction" }, 404, cors());
    if (tx.status === "cancelled") return json({ error: "Cannot pay cancelled transaction" }, 400, cors());

    const newPaid = Math.min(Number(tx.amount), Number(tx.amount_paid) + payAmount);
    const newStatus = newPaid >= Number(tx.amount) ? "paid" : "pending";

    await env.DB.prepare(
      `UPDATE ${txTable}
          SET amount_paid = ?, status = ?
        WHERE id = ? AND user_id = ?`
    ).bind(newPaid, newStatus, transaction_id, user.user_id).run();

    // Insert ledger row using your schema/column names
    const payId = crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare(
      `INSERT INTO customer_payments
         (id, user_id, transaction_id, customer_id, product_name, payment_amount, payment_date, notes, created_at)
       VALUES
         (?,  ?,      ?,              ?,           ?,            ?,              ?,             ?,    CAST(strftime('%s','now') AS INTEGER))`
    ).bind(
      payId,
      user.user_id,
      transaction_id,
      tx.customer_id,
      tx.product_name ?? null,
      payAmount,
      payDate,
      notes
    ).run();

    return json({ ok: true, transaction_id, amount_paid: newPaid, status: newStatus }, 200, cors());
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

/* --------------- helpers --------------- */

function json(data: any, status = 200, headers?: Record<string,string>) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function safeJson(req: Request) { try { return await req.json(); } catch { return null; } }
async function hasTable(env: any, name: string) {
  const r = await env.DB.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
  ).bind(name).first();
  return !!r;
}
async function ensurePaymentsTable(env: any) {
  // Create with EXACT columns from 0011_customer_payments.sql if missing
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS customer_payments (
       id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       user_id        TEXT NOT NULL,
       transaction_id TEXT NOT NULL,
       customer_id    TEXT NOT NULL,
       product_name   TEXT,
       payment_amount REAL NOT NULL DEFAULT 0,
       payment_date   TEXT NOT NULL,
       notes          TEXT,
       created_at     INTEGER NOT NULL DEFAULT (unixepoch())
     )`
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_pay_user_date  ON customer_payments(user_id, payment_date)`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_pay_customer   ON customer_payments(customer_id)`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_pay_tx         ON customer_payments(transaction_id)`
  ).run();
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
