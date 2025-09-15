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
  if (method !== "POST")    return json({ error: "Method not allowed" }, 405, cors());

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  const txTable = (await hasTable(env, "customer_transactions"))
    ? "customer_transactions"
    : (await hasTable(env, "transactions")) ? "transactions" : null;
  if (!txTable) return json({ error: "Transactions table missing" }, 500, cors());

  const b = await safeJson(request);
  const transaction_id = String(b?.transaction_id ?? "").trim();
  const payAmount = Number(b?.amount ?? 0) || 0;
  const date = String(b?.date ?? "").trim() || new Date().toISOString().slice(0,10);
  const notes = (b?.notes ?? "").toString().trim() || null;

  if (!transaction_id) return json({ error: "transaction_id is required" }, 400, cors());
  if (payAmount <= 0)  return json({ error: "amount must be > 0" }, 400, cors());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());

  const tx = await env.DB.prepare(
    `SELECT id, user_id, amount, amount_paid, status FROM ${txTable} WHERE id = ? AND user_id = ?`
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

  // (Optional) if you later add a payments log table, insert into it here.

  return json({ ok: true, transaction_id, amount_paid: newPaid, status: newStatus }, 200, cors());
}

function json(data: any, status = 200, headers?: Record<string,string>) {
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
