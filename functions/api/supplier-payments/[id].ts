// DELETE /api/supplier-payments/:id
export async function onRequest({ request, env, params }: any) {
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
        headers["access-control-allow-methods"] = "GET,POST,DELETE,OPTIONS";
      }
      return headers;
    };
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (method !== "DELETE") return json({ error: "Method not allowed" }, 405, cors());
  
    const user = await getUserFromSession(env, request);
    if (!user) return json({ error: "Unauthorized" }, 401, cors());
  
    const id = String(params?.id || "").trim();
    if (!id) return json({ error: "Missing id" }, 400, cors());
  
    // Fetch payment/debt row
    const pmt = await env.DB.prepare(
      `SELECT id, user_id, supplier_id, transaction_id, amount, type
       FROM supplier_payments
       WHERE id = ? AND user_id = ?`
    ).bind(id, user.user_id).first();
  
    if (!pmt) return json({ error: "Payment not found" }, 404, cors());
  
    const supplierId = pmt.supplier_id;
    const txId = pmt.transaction_id;
    const amt = Number(pmt.amount) || 0;
    const type = String(pmt.type || "payment");
  
    // Fetch related supplier transaction
    const tx = await env.DB.prepare(
      `SELECT id, amount, amount_paid, status
       FROM supplier_transactions
       WHERE id = ? AND user_id = ? AND supplier_id = ?`
    ).bind(txId, user.user_id, supplierId).first();
  
    if (!tx) return json({ error: "Related transaction not found" }, 404, cors());
  
    if (type === "payment") {
      // Reverse a payment: subtract from amount_paid (not below zero)
      const newPaid = Math.max(0, Number(tx.amount_paid || 0) - amt);
      // Recompute status
      const newStatus = newPaid >= Number(tx.amount) ? "paid" : "pending";
  
      await env.DB.prepare(
        `UPDATE supplier_transactions
         SET amount_paid = ?, status = ?
         WHERE id = ?`
      ).bind(newPaid, newStatus, tx.id).run();
  
      // Delete the payment row
      await env.DB.prepare(
        `DELETE FROM supplier_payments WHERE id = ? AND user_id = ?`
      ).bind(id, user.user_id).run();
  
      return json({ ok: true, reversed: "payment", transaction: { id: tx.id, amount_paid: newPaid, status: newStatus } }, 200, cors());
    }
  
    if (type === "debt") {
      // "Debt" history entries represent the creation of a new debt (a transaction)
      // Allow deletion only if no payments applied yet.
      if (Number(tx.amount_paid) > 0) {
        return json({ error: "Cannot delete debt: payments already applied. Reverse those payments first." }, 409, cors());
      }
  
      // Delete transaction completely -> total outstanding drops by its amount
      await env.DB.prepare(
        `DELETE FROM supplier_transactions WHERE id = ?`
      ).bind(tx.id).run();
  
      // Delete the history row
      await env.DB.prepare(
        `DELETE FROM supplier_payments WHERE id = ? AND user_id = ?`
      ).bind(id, user.user_id).run();
  
      return json({ ok: true, reversed: "debt", removed_transaction: tx.id }, 200, cors());
    }
  
    return json({ error: "Unknown type" }, 400, cors());
  }
  
  function json(data: any, status = 200, headers?: Record<string, string>) {
    return new Response(JSON.stringify(data), { status, headers });
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
  