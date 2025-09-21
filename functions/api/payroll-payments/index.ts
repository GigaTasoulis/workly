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
      h["access-control-allow-methods"] = "POST,OPTIONS";
    }
    return h;
  };
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  if (method !== "POST") return json({ error: "Method not allowed" }, 405, cors());

  const b = await safeJson(request);
  const n = (x: any) => Number(x ?? 0) || 0;

  const amount = n(b?.amount);
  if (!(amount > 0)) return json({ error: "amount must be > 0" }, 400, cors());

  const date = String(b?.date || "").trim() || new Date().toISOString().slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());

  // Allow caller to pass either transaction_id or worklog_id
  let tx = null;
  if (b?.transaction_id) {
    tx = await env.DB.prepare(
      `SELECT id, employee_id, worklog_id, amount, amount_paid, status FROM payroll_transactions
       WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, String(b.transaction_id).trim()).first();
  } else if (b?.worklog_id) {
    tx = await env.DB.prepare(
      `SELECT id, employee_id, worklog_id, amount, amount_paid, status FROM payroll_transactions
       WHERE user_id = ? AND worklog_id = ?`
    ).bind(user.user_id, String(b.worklog_id).trim()).first();
  } else {
    return json({ error: "transaction_id or worklog_id required" }, 400, cors());
  }
  if (!tx) return json({ error: "transaction not found" }, 404, cors());

  const newPaid = Math.min(n(tx.amount), n(tx.amount_paid) + amount);
  const newStatus = newPaid >= n(tx.amount) ? "paid" : "pending";

  // 1) insert payment
  const pid = crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare(
    `INSERT INTO payroll_payments
      (id, user_id, transaction_id, worklog_id, employee_id, amount, date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    pid, user.user_id, tx.id, tx.worklog_id, tx.employee_id, amount, date,
    String(b?.note || "").trim() || null
  ).run();

  // 2) bump transaction totals
  await env.DB.prepare(
    `UPDATE payroll_transactions
        SET amount_paid = ?, status = ?, updated_at = strftime('%s','now')
      WHERE user_id = ? AND id = ?`
  ).bind(newPaid, newStatus, user.user_id, tx.id).run();

  return json({ ok: true, payment: { id: pid }, transaction: { id: tx.id, amount_paid: newPaid, status: newStatus } }, 201, cors());
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
