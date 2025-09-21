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

  if (method === "GET") {
    const url = new URL(request.url);
    const employeeId = (url.searchParams.get("employeeId") || "").trim();
    const status = (url.searchParams.get("status") || "").trim(); // "paid" | "pending"
    const from = (url.searchParams.get("from") || "").trim();
    const to = (url.searchParams.get("to") || "").trim();

    const where: string[] = ["user_id = ?"];
    const vals: any[] = [user.user_id];
    if (employeeId) {
      where.push("employee_id = ?");
      vals.push(employeeId);
    }
    if (from) {
      where.push("date >= ?");
      vals.push(from);
    }
    if (to) {
      where.push("date <= ?");
      vals.push(to);
    }
    if (status) {
      if (status !== "paid" && status !== "pending")
        return json({ error: "Invalid status" }, 400, cors());
      if (status === "paid") where.push("amount_paid >= total_amount");
      if (status === "pending") where.push("amount_paid < total_amount");
    }

    const rows = await env.DB.prepare(
      `SELECT id, employee_id, workplace_id, date, hours_worked, notes, total_amount, amount_paid, created_at
       FROM worklogs
       WHERE ${where.join(" AND ")}
       ORDER BY date DESC, created_at DESC`,
    )
      .bind(...vals)
      .all();

    return json({ worklogs: rows.results ?? [] }, 200, cors());
  }

  if (method === "POST") {
    const b = await safeJson(request);
    const employee_id = String(b?.employee_id ?? b?.employeeId ?? "").trim();
    const workplace_id = String(b?.workplace_id ?? b?.workplaceId ?? "").trim();
    let date = String(b?.date ?? "").trim();
    const hours_worked = Number(b?.hours_worked ?? b?.hoursWorked ?? 0);
    const total_amount = Number(b?.total_amount ?? b?.totalAmount ?? 0);
    const amount_paid = Number(b?.amount_paid ?? b?.amountPaid ?? 0);
    const notes = String(b?.notes ?? "")
      .trim()
      .slice(0, 2000);

    if (!employee_id) return json({ error: "employee_id is required" }, 400, cors());
    if (!workplace_id) return json({ error: "workplace_id is required" }, 400, cors());
    if (!date) date = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return json({ error: "date must be YYYY-MM-DD" }, 400, cors());

    if (!Number.isFinite(hours_worked) || hours_worked < 0)
      return json({ error: "hours_worked must be >= 0" }, 400, cors());
    if (!Number.isFinite(total_amount) || total_amount < 0)
      return json({ error: "total_amount must be >= 0" }, 400, cors());
    if (!Number.isFinite(amount_paid) || amount_paid < 0)
      return json({ error: "amount_paid must be >= 0" }, 400, cors());

    const emp = await env.DB.prepare(`SELECT 1 FROM employees WHERE user_id = ? AND id = ?`)
      .bind(user.user_id, employee_id)
      .first();
    if (!emp) return json({ error: "employee not found" }, 404, cors());

    const wp = await env.DB.prepare(`SELECT 1 FROM workplaces WHERE user_id = ? AND id = ?`)
      .bind(user.user_id, workplace_id)
      .first();
    if (!wp) return json({ error: "workplace not found" }, 404, cors());

    const id = crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare(
      `INSERT INTO worklogs
       (id, user_id, employee_id, workplace_id, date, hours_worked, notes, total_amount, amount_paid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.user_id,
        employee_id,
        workplace_id,
        date,
        hours_worked,
        notes,
        total_amount,
        amount_paid,
      )
      .run();

    return json(
      {
        worklog: {
          id,
          employee_id,
          workplace_id,
          date,
          hours_worked,
          notes,
          total_amount,
          amount_paid,
        },
      },
      201,
      cors(),
    );
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
