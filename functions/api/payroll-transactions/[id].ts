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
      h["access-control-allow-methods"] = "PUT,DELETE,OPTIONS";
    }
    return h;
  };
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (!id) return json({ error: "Missing id" }, 400, cors());

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  const n = (x: any) => Number(x ?? 0) || 0;

  if (method === "PUT") {
    const b = await safeJson(request);

    const existing = await env.DB.prepare(
      `SELECT id, amount, amount_paid FROM payroll_transactions WHERE user_id = ? AND id = ?`
    ).bind(user.user_id, id).first();
    if (!existing) return json({ error: "Not found" }, 404, cors());

    const sets: string[] = [];
    const vals: any[] = [];

    if (b?.employee_id !== undefined || b?.employeeId !== undefined) {
      sets.push("employee_id = ?"); vals.push(String(b.employee_id ?? b.employeeId).trim());
    }
    if (b?.worklog_id !== undefined || b?.worklogId !== undefined) {
      sets.push("worklog_id = ?"); vals.push(String(b.worklog_id ?? b.worklogId).trim());
    }
    if (b?.amount !== undefined)      { sets.push("amount = ?");      vals.push(n(b.amount)); }
    if (b?.amount_paid !== undefined || b?.amountPaid !== undefined) {
      sets.push("amount_paid = ?");   vals.push(n(b.amount_paid ?? b.amountPaid));
    }
    if (b?.date !== undefined) {
      const d = String(b.date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: "date must be YYYY-MM-DD" }, 400, cors());
      sets.push("date = ?"); vals.push(d);
    }
    if (b?.status !== undefined) {
      const st = String(b.status).trim();
      if (!["pending","paid","cancelled"].includes(st)) return json({ error: "Invalid status" }, 400, cors());
      sets.push("status = ?"); vals.push(st);
    }
    if (b?.notes !== undefined) { sets.push("notes = ?"); vals.push(String(b.notes).trim().slice(0,2000)); }

    // auto-status if not supplied but amounts changed
    const newAmount = ("amount" in b) ? n(b.amount) : existing.amount;
    const newPaid   = ("amount_paid" in b || "amountPaid" in b) ? n(b.amount_paid ?? b.amountPaid) : existing.amount_paid;
    if (!("status" in b) && Number.isFinite(newAmount) && Number.isFinite(newPaid)) {
      sets.push("status = ?"); vals.push(newPaid >= newAmount ? "paid" : "pending");
    }

    if (sets.length === 0) return json({ error: "No fields to update" }, 400, cors());
    sets.push("updated_at = strftime('%s','now')");

    vals.push(user.user_id, id);
    const res = await env.DB.prepare(
      `UPDATE payroll_transactions SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`
    ).bind(...vals).run();
    if (!res.meta || res.meta.changes === 0) return json({ error: "Not found" }, 404, cors());
    return json({ ok: true }, 200, cors());
  }

  if (method === "DELETE") {
    const res = await env.DB.prepare(
      `DELETE FROM payroll_transactions WHERE user_id = ? AND id = ?`
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
