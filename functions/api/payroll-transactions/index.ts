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
      h["access-control-allow-methods"] = "GET,POST,DELETE,OPTIONS";
    }
    return h;
  };
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  const n = (x: any) => Number(x ?? 0) || 0;

  if (method === "GET") {
    const url = new URL(request.url);
    const employeeId = (url.searchParams.get("employeeId") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();
    const where: string[] = ["user_id = ?"];
    const vals: any[] = [user.user_id];
    if (employeeId) {
      where.push("employee_id = ?");
      vals.push(employeeId);
    }
    if (status) {
      if (!["pending", "paid", "cancelled"].includes(status))
        return json({ error: "Invalid status" }, 400, cors());
      where.push("status = ?");
      vals.push(status);
    }
    const rows = await env.DB.prepare(
      `SELECT id, employee_id, worklog_id, amount, amount_paid, date, status, notes, created_at, updated_at
         FROM payroll_transactions
        WHERE ${where.join(" AND ")}
        ORDER BY date DESC, created_at DESC`,
    )
      .bind(...vals)
      .all();

    return json({ transactions: rows.results ?? [] }, 200, cors());
  }

  if (method === "POST") {
    // Supports upsert by worklog_id:
    // { upsert:true, employee_id, worklog_id, amount, amount_paid?, date, status?, notes? }
    const b = await safeJson(request);

    if (b?.deleteByWorklogId) {
      // convenience: { deleteByWorklogId: true, worklog_id }
      const wid = String(b?.worklog_id || "").trim();
      if (!wid) return json({ error: "worklog_id required" }, 400, cors());
      const res = await env.DB.prepare(
        `DELETE FROM payroll_transactions WHERE user_id = ? AND worklog_id = ?`,
      )
        .bind(user.user_id, wid)
        .run();
      return json({ ok: true, deleted: res.meta?.changes ?? 0 }, 200, cors());
    }

    if (!b?.upsert) return json({ error: "upsert required" }, 400, cors());
    const employee_id = String(b?.employee_id || "").trim();
    const worklog_id = String(b?.worklog_id || "").trim();
    const date = String(b?.date || "").trim() || new Date().toISOString().slice(0, 10);
    const amount = n(b?.amount);
    const paid = n(b?.amount_paid);
    const notes = b?.notes ? String(b.notes).trim().slice(0, 2000) : null;

    if (!employee_id) return json({ error: "employee_id required" }, 400, cors());
    if (!worklog_id) return json({ error: "worklog_id required" }, 400, cors());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return json({ error: "date must be YYYY-MM-DD" }, 400, cors());
    if (!(amount > 0)) return json({ error: "amount must be > 0" }, 400, cors());

    const status = paid >= amount ? "paid" : String(b?.status || "pending").trim();

    const existing = await env.DB.prepare(
      `SELECT id FROM payroll_transactions WHERE user_id = ? AND worklog_id = ?`,
    )
      .bind(user.user_id, worklog_id)
      .first();

    if (existing) {
      await env.DB.prepare(
        `UPDATE payroll_transactions
            SET employee_id = ?, amount = ?, amount_paid = ?, date = ?, status = ?, notes = ?, updated_at = strftime('%s','now')
          WHERE user_id = ? AND worklog_id = ?`,
      )
        .bind(employee_id, amount, paid, date, status, notes, user.user_id, worklog_id)
        .run();
      return json({ ok: true, id: existing.id, mode: "updated" }, 200, cors());
    } else {
      const id = crypto.randomUUID().replace(/-/g, "");
      await env.DB.prepare(
        `INSERT INTO payroll_transactions
          (id, user_id, employee_id, worklog_id, amount, amount_paid, date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, user.user_id, employee_id, worklog_id, amount, paid, date, status, notes)
        .run();
      return json({ ok: true, id, mode: "inserted" }, 201, cors());
    }
  }

  if (method === "DELETE") {
    // DELETE /api/payroll-transactions?worklog_id=...
    const url = new URL(request.url);
    const wid = (url.searchParams.get("worklog_id") || "").trim();
    if (!wid) return json({ error: "worklog_id required" }, 400, cors());
    const res = await env.DB.prepare(
      `DELETE FROM payroll_transactions WHERE user_id = ? AND worklog_id = ?`,
    )
      .bind(user.user_id, wid)
      .run();
    return json({ ok: true, deleted: res.meta?.changes ?? 0 }, 200, cors());
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

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
