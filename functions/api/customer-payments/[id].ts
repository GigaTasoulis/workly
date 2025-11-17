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
      h["access-control-allow-methods"] = "GET,PUT,PATCH,DELETE,OPTIONS";
    }
    return h;
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (!id) return json({ error: "Missing id" }, 400, cors());

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  const txTable = (await hasTable(env, "customer_transactions"))
    ? "customer_transactions"
    : (await hasTable(env, "transactions"))
      ? "transactions"
      : null;
  if (!txTable) return json({ error: "Transactions table missing" }, 500, cors());

  if (method === "GET") {
    const row = await env.DB.prepare(
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
          WHERE user_id = ? AND id = ?`,
    )
      .bind(user.user_id, id)
      .first();
    if (!row) return json({ error: "Not found" }, 404, cors());
    return json({ payment: row }, 200, cors());
  }

  // EDIT payment: allow amount, date, notes
  // If amount changes, adjust linked transaction.amount_paid + status
  if (method === "PUT" || method === "PATCH") {
    const b = await safeJson(request);

    // Ensure payment exists and get current amount + linked transaction id
    const pay = await env.DB.prepare(
      `SELECT id, transaction_id, payment_amount
         FROM customer_payments
        WHERE user_id = ? AND id = ?`,
    )
      .bind(user.user_id, id)
      .first();
    if (!pay) return json({ error: "Not found" }, 404, cors());

    const sets: string[] = [];
    const vals: any[] = [];

    let newTxPaid: number | null = null;
    let newTxStatus: string | null = null;

    // --- amount (payment_amount) ---
    if (b?.amount !== undefined) {
      const newAmount = Number(b.amount) || 0;
      if (newAmount <= 0) {
        return json({ error: "amount must be > 0" }, 400, cors());
      }

      // Load linked transaction to recompute amount_paid + status
      const tx = await env.DB.prepare(
        `SELECT id, amount, amount_paid, status
           FROM ${txTable}
          WHERE user_id = ? AND id = ?`,
      )
        .bind(user.user_id, pay.transaction_id)
        .first();
      if (!tx) return json({ error: "Linked transaction not found" }, 404, cors());

      const amountTotal = Number(tx.amount) || 0;
      const currentPaid = Number(tx.amount_paid) || 0;
      const oldAmount = Number(pay.payment_amount) || 0;
      const otherPaid = currentPaid - oldAmount;

      // Max allowed for this payment so we don't exceed total tx amount
      const maxForThisPayment = Math.max(0, amountTotal - otherPaid);
      if (newAmount > maxForThisPayment) {
        return json(
          {
            error: "Το ποσό είναι μεγαλύτερο από το επιτρεπόμενο υπόλοιπο για αυτή τη συναλλαγή.",
          },
          400,
          cors(),
        );
      }

      const updatedPaid = otherPaid + newAmount;
      const updatedStatus = updatedPaid >= amountTotal ? "paid" : "pending";

      newTxPaid = updatedPaid;
      newTxStatus = updatedStatus;

      sets.push("payment_amount = ?");
      vals.push(newAmount);
    }

    // --- date ---
    if (b?.date !== undefined) {
      const d = String(b.date).trim();
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return json({ error: "date must be YYYY-MM-DD" }, 400, cors());
      }
      sets.push("payment_date = ?");
      vals.push(d || null);
    }

    // --- notes ---
    if (b?.notes !== undefined) {
      sets.push("notes = ?");
      vals.push((b.notes ?? "").toString().trim().slice(0, 2000) || null);
    }

    if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());

    // First, if needed, update the linked transaction
    if (newTxPaid !== null && newTxStatus !== null) {
      const resTx = await env.DB.prepare(
        `UPDATE ${txTable}
            SET amount_paid = ?, status = ?
          WHERE user_id = ? AND id = ?`,
      )
        .bind(newTxPaid, newTxStatus, user.user_id, pay.transaction_id)
        .run();

      if (!resTx.meta || resTx.meta.changes === 0) {
        return json({ error: "Failed to update linked transaction" }, 500, cors());
      }
    }

    // Then update the payment row itself
    vals.push(user.user_id, id);
    const res = await env.DB.prepare(
      `UPDATE customer_payments SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`,
    )
      .bind(...vals)
      .run();

    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());

    return json(
      {
        ok: true,
        transaction_id: pay.transaction_id,
        amount_paid: newTxPaid,
        status: newTxStatus,
      },
      200,
      cors(),
    );
  }

  // DELETE = void payment (reverse effect on linked transaction) then delete row
  if (method === "DELETE") {
    // fetch ledger row
    const pay = await env.DB.prepare(
      `SELECT id, transaction_id, payment_amount
           FROM customer_payments
          WHERE user_id = ? AND id = ?`,
    )
      .bind(user.user_id, id)
      .first();
    if (!pay) return json({ error: "Not found" }, 404, cors());

    // fetch tx
    const tx = await env.DB.prepare(
      `SELECT id, amount, amount_paid, status
           FROM ${txTable}
          WHERE user_id = ? AND id = ?`,
    )
      .bind(user.user_id, pay.transaction_id)
      .first();
    if (!tx) return json({ error: "Linked transaction not found" }, 404, cors());

    const currentPaid = Number(tx.amount_paid) || 0;
    const toSubtract = Number(pay.payment_amount) || 0;
    const newPaid = Math.max(0, currentPaid - toSubtract);
    const newStatus = newPaid >= Number(tx.amount) ? "paid" : "pending";

    await env.DB.prepare(
      `UPDATE ${txTable}
            SET amount_paid = ?, status = ?
          WHERE user_id = ? AND id = ?`,
    )
      .bind(newPaid, newStatus, user.user_id, tx.id)
      .run();

    const del = await env.DB.prepare(`DELETE FROM customer_payments WHERE user_id = ? AND id = ?`)
      .bind(user.user_id, id)
      .run();

    if (!del.meta || del.meta.changes === 0) {
      // rollback (best effort)
      await env.DB.prepare(
        `UPDATE ${txTable} SET amount_paid = ?, status = ? WHERE user_id = ? AND id = ?`,
      )
        .bind(currentPaid, tx.status, user.user_id, tx.id)
        .run();
      return json({ error: "Delete failed" }, 500, cors());
    }

    return json(
      { ok: true, transaction_id: tx.id, amount_paid: newPaid, status: newStatus },
      200,
      cors(),
    );
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

// json, safeJson, hasTable, getUserFromSession helpers stay as you have them

/* helpers */
function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
async function hasTable(env: any, name: string) {
  const r = await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .bind(name)
    .first();
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
        WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(sid, now)
    .first();
}
