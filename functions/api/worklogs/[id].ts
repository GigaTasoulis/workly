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
      h["access-control-allow-methods"] = "GET,PUT,DELETE,OPTIONS";
    }
    return h;
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (!id) return json({ error: "Missing id" }, 400, cors());

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  if (method === "GET") {
    const row = await env.DB.prepare(
      `SELECT id, employee_id, workplace_id, date, hours_worked, notes, total_amount, amount_paid, created_at
       FROM worklogs WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, id).first();
    if (!row) return json({ error: "Not found" }, 404, cors());
    return json({ worklog: row }, 200, cors());
  }

  if (method === "PUT") {
    const existing = await env.DB.prepare(
      `SELECT id FROM worklogs WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, id).first();
    if (!existing) return json({ error: "Not found" }, 404, cors());

    const b = await safeJson(request);
    const sets: string[] = [];
    const vals: any[] = [];

    if (b?.employee_id !== undefined || b?.employeeId !== undefined) {
      const empId = String(b.employee_id ?? b.employeeId ?? "").trim();
      if (!empId) return json({ error: "employee_id cannot be empty" }, 400, cors());
      const emp = await env.DB.prepare(
        `SELECT 1 FROM employees WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, empId).first();
      if (!emp) return json({ error: "employee not found" }, 404, cors());
      sets.push("employee_id = ?"); vals.push(empId);
    }

    if (b?.workplace_id !== undefined || b?.workplaceId !== undefined) {
      const wpId = String(b.workplace_id ?? b.workplaceId ?? "").trim();
      if (!wpId) return json({ error: "workplace_id cannot be empty" }, 400, cors());
      const wp = await env.DB.prepare(
        `SELECT 1 FROM workplaces WHERE user_id = ? AND id = ?`
      ).bind(user.user_id, wpId).first();
      if (!wp) return json({ error: "workplace not found" }, 404, cors());
      sets.push("workplace_id = ?"); vals.push(wpId);
    }

    if (b?.date !== undefined) {
      const d = String(b.date).trim();
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());
      sets.push("date = ?"); vals.push(d || null);
    }
    if (b?.hours_worked !== undefined || b?.hoursWorked !== undefined) {
      const v = Number(b.hours_worked ?? b.hoursWorked);
      if (!Number.isFinite(v) || v < 0) return json({ error: "hours_worked must be >= 0" }, 400, cors());
      sets.push("hours_worked = ?"); vals.push(v);
    }
    if (b?.total_amount !== undefined || b?.totalAmount !== undefined) {
      const v = Number(b.total_amount ?? b.totalAmount);
      if (!Number.isFinite(v) || v < 0) return json({ error: "total_amount must be >= 0" }, 400, cors());
      sets.push("total_amount = ?"); vals.push(v);
    }
    if (b?.amount_paid !== undefined || b?.amountPaid !== undefined) {
      const v = Number(b.amount_paid ?? b.amountPaid);
      if (!Number.isFinite(v) || v < 0) return json({ error: "amount_paid must be >= 0" }, 400, cors());
      sets.push("amount_paid = ?"); vals.push(v);
    }
    if (b?.notes !== undefined) {
      sets.push("notes = ?"); vals.push(String(b.notes).toString().trim().slice(0, 2000));
    }

    if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());

    vals.push(user.user_id, id);
    const res = await env.DB.prepare(
      `UPDATE worklogs SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`
    ).bind(...vals).run();

    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
    return json({ ok: true }, 200, cors());
  }

  if (method === "DELETE") {
    const res = await env.DB.prepare(
      `DELETE FROM worklogs WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, id).run();
    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
    return json({ ok: true }, 200, cors());
  }

  return json({ error: "Method not allowed" }, 405, cors());
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
