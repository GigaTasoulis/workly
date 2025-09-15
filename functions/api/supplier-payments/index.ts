// functions/api/supplier-payments/index.ts

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
  
    // ensure table exists (and give a helpful error instead of a 500)
    const hasPayments = await hasTable(env, "supplier_payments");
    if (!hasPayments) {
      return json({ error: "Supplier payments table missing. Add a migration for `supplier_payments`." }, 500, cors());
    }
  
    if (method === "GET") {
      const url = new URL(request.url);
      const supplierId = (url.searchParams.get("supplierId") || "").trim();
      const txId = (url.searchParams.get("transactionId") || "").trim();
  
      const where = ["p.user_id = ?"];
      const vals: any[] = [user.user_id];
      if (supplierId) { where.push("p.supplier_id = ?"); vals.push(supplierId); }
      if (txId) { where.push("p.transaction_id = ?"); vals.push(txId); }
  
      // include useful joined fields for the history UI
      const rows = await env.DB.prepare(
        `SELECT
           p.id, p.supplier_id, p.transaction_id, p.amount, p.date, p.notes, p.type, p.created_at,
           s.name  AS supplier_name,
           t.product_name
         FROM supplier_payments p
         JOIN suppliers s ON s.id = p.supplier_id
         JOIN supplier_transactions t ON t.id = p.transaction_id
         WHERE ${where.join(" AND ")}
         ORDER BY p.date DESC, p.created_at DESC`
      ).bind(...vals).all();
  
      return json({ payments: rows.results ?? [] }, 200, cors());
    }
  
    if (method === "POST") {
      const body = await safeJson(request);
  
      const supplier_id   = String(body?.supplier_id || "").trim();
      const transaction_id= String(body?.transaction_id || "").trim();
      const amount        = Number(body?.amount);
      const date          = String(body?.date || "").trim() || new Date().toISOString().slice(0,10);
      const notes         = (body?.notes ?? "").toString().trim().slice(0, 2000);
      const type          = (String(body?.type || "payment").trim() || "payment") as "payment" | "debt";
  
      if (!supplier_id) return json({ error: "supplier_id is required" }, 400, cors());
      if (!transaction_id) return json({ error: "transaction_id is required" }, 400, cors());
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "amount must be > 0" }, 400, cors());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());
      if (!["payment","debt"].includes(type)) return json({ error: "type must be 'payment' or 'debt'" }, 400, cors());
  
      // Check ownership and validate transaction
      const tx = await env.DB.prepare(
        `SELECT id, supplier_id, amount, amount_paid, status
           FROM supplier_transactions
          WHERE id = ? AND user_id = ?`
      ).bind(transaction_id, user.user_id).first();
  
      if (!tx) return json({ error: "Not found: transaction" }, 404, cors());
      if (tx.supplier_id !== supplier_id) return json({ error: "Transaction does not belong to supplier" }, 400, cors());
  
      if (type === "payment") {
        const remaining = Number(tx.amount) - Number(tx.amount_paid);
        if (amount > remaining) {
          return json({ error: "Payment exceeds remaining balance" }, 400, cors());
        }
      }
  
      const id = crypto.randomUUID().replace(/-/g, "");
  
      // Insert ledger entry
      await env.DB.prepare(
        `INSERT INTO supplier_payments
           (id, user_id, supplier_id, transaction_id, amount, date, notes, type)
         VALUES (?,  ?,       ?,          ?,             ?,      ?,    ?,     ?)`
      ).bind(id, user.user_id, supplier_id, transaction_id, amount, date, notes, type).run();
  
      // If it's a payment, also apply it to the transaction
      if (type === "payment") {
        await env.DB.prepare(
          `UPDATE supplier_transactions
              SET amount_paid = amount_paid + ?,
                  status = CASE WHEN amount_paid + ? >= amount THEN 'paid' ELSE status END
            WHERE id = ? AND user_id = ?`
        ).bind(amount, amount, transaction_id, user.user_id).run();
      }
  
      return json({ ok: true, payment: { id } }, 201, cors());
    }
  
    return json({ error: "Method not allowed" }, 405, cors());
  }
  
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
  