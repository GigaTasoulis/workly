// functions/api/dashboard/summary.ts
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
      h["access-control-allow-methods"] = "GET,OPTIONS";
    }
    return h;
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (method !== "GET") return json({ error: "Method not allowed" }, 405, cors());

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  // Helpers
  const n = (x: any) => Number(x ?? 0) || 0;
  const hasTable = async (name: string) => {
    const r = await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .bind(name)
      .first();
    return !!r;
  };
  const safeFirst = async (sql: string, binds: any[]) => {
    try {
      return await env.DB.prepare(sql)
        .bind(...binds)
        .first();
    } catch (e: any) {
      if (
        String(e?.message || e)
          .toLowerCase()
          .includes("no such table")
      )
        return null;
      throw e;
    }
  };

  // Parse month filter (?month=YYYY-MM). We filter by date >= monthStart AND date < nextMonthStart
  const url = new URL(request.url);
  const month = (url.searchParams.get("month") || "").trim(); // "" means "all time"
  const hasMonth = /^\d{4}-\d{2}$/.test(month);
  const monthStart = hasMonth ? `${month}-01` : null;
  const nextMonthStart = hasMonth ? nextMonth(month) : null;

  // Choose correct customer transactions table
  const ctTable = (await hasTable("customer_transactions"))
    ? "customer_transactions"
    : (await hasTable("transactions"))
      ? "transactions"
      : null;
  const stTable = (await hasTable("supplier_transactions")) ? "supplier_transactions" : null;
  const ptTable = (await hasTable("payroll_transactions")) ? "payroll_transactions" : null;

  try {
    // ---------- COUNTS (lifetime, not month-filtered) ----------
    const [sup, wp, cust, emp] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS c FROM suppliers  WHERE user_id = ?")
        .bind(user.user_id)
        .first(),
      env.DB.prepare("SELECT COUNT(*) AS c FROM workplaces WHERE user_id = ?")
        .bind(user.user_id)
        .first(),
      env.DB.prepare("SELECT COUNT(*) AS c FROM customers  WHERE user_id = ?")
        .bind(user.user_id)
        .first(),
      env.DB.prepare("SELECT COUNT(*) AS c FROM employees  WHERE user_id = ?")
        .bind(user.user_id)
        .first(),
    ]);
    const counts = {
      suppliers: n(sup?.c),
      workplaces: n(wp?.c),
      customers: n(cust?.c),
      employees: n(emp?.c),
    };

    // ---------- FINANCIALS (month-filtered when ?month is present) ----------
    const dateFilter = hasMonth ? " AND date >= ? AND date < ? " : " ";

    // Revenue from customer transactions
    let revenue = 0;
    if (ctTable) {
      const revRow = await safeFirst(
        `SELECT COALESCE(SUM(amount_paid), 0) AS v FROM ${ctTable} WHERE user_id = ?${dateFilter}`,
        hasMonth ? [user.user_id, monthStart, nextMonthStart] : [user.user_id],
      );
      revenue = n(revRow?.v);
    }

    // Expenses = suppliers + payroll (sum of amount_paid)
    let expensesSuppliers = 0;
    if (stTable) {
      const expSup = await safeFirst(
        `SELECT COALESCE(SUM(amount_paid), 0) AS v FROM ${stTable} WHERE user_id = ?${dateFilter}`,
        hasMonth ? [user.user_id, monthStart, nextMonthStart] : [user.user_id],
      );
      expensesSuppliers = n(expSup?.v);
    }

    let expensesPayroll = 0;
    if (ptTable) {
      const expPay = await safeFirst(
        `SELECT COALESCE(SUM(amount_paid), 0) AS v FROM ${ptTable} WHERE user_id = ?${dateFilter}`,
        hasMonth ? [user.user_id, monthStart, nextMonthStart] : [user.user_id],
      );
      expensesPayroll = n(expPay?.v);
    }

    const expenses = n(expensesSuppliers + expensesPayroll);
    const netBalance = n(revenue - expenses);

    // ---------- ACTIVE TRANSACTIONS (pending, month-filtered if provided) ----------
    let activeTransactionsCount = 0;

    if (ctTable) {
      const pCust = await safeFirst(
        `SELECT COUNT(*) AS c FROM ${ctTable}
          WHERE user_id = ? AND status = 'pending'${dateFilter}`,
        hasMonth ? [user.user_id, monthStart, nextMonthStart] : [user.user_id],
      );
      activeTransactionsCount += n(pCust?.c);
    }

    if (stTable) {
      const pSup = await safeFirst(
        `SELECT COUNT(*) AS c FROM ${stTable}
          WHERE user_id = ? AND status = 'pending'${dateFilter}`,
        hasMonth ? [user.user_id, monthStart, nextMonthStart] : [user.user_id],
      );
      activeTransactionsCount += n(pSup?.c);
    }

    // ---------- TOP CUSTOMERS by revenue (month-filtered if provided) ----------
    let topCustomers: Array<{ id: string; name: string; email: string; revenue: number }> = [];
    if (ctTable) {
      const sql = `
        SELECT c.id, c.name, c.email,
              COALESCE(SUM(COALESCE(t.amount_paid,0)), 0) AS revenue
          FROM customers c
    LEFT JOIN ${ctTable} t
            ON t.customer_id = c.id
          AND t.user_id = c.user_id
          ${hasMonth ? "AND t.date >= ? AND t.date < ?" : ""}
        WHERE c.user_id = ?
      GROUP BY c.id, c.name, c.email
        HAVING revenue > 0
      ORDER BY revenue DESC
        LIMIT 4`;
      const binds = hasMonth ? [monthStart, nextMonthStart, user.user_id] : [user.user_id];
      const rows = await env.DB.prepare(sql)
        .bind(...binds)
        .all();

      topCustomers = (rows?.results ?? []).map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        email: String(r.email || ""),
        revenue: Number(r.revenue) || 0,
      }));
    }

    if (ptTable) {
      const pPay = await safeFirst(
        `SELECT COUNT(*) AS c FROM ${ptTable}
          WHERE user_id = ? AND status = 'pending'${dateFilter}`,
        hasMonth ? [user.user_id, monthStart, nextMonthStart] : [user.user_id],
      );
      activeTransactionsCount += n(pPay?.c);
    }

    // ---------- TOP DEBTS (lifetime outstanding; not month-filtered) ----------
    let topDebts: Array<{ id: string; name: string; debt: number }> = [];
    if (ctTable) {
      const q = await env.DB.prepare(
        `SELECT c.id AS id, c.name AS name,
                COALESCE(SUM(COALESCE(t.amount,0) - COALESCE(t.amount_paid,0)), 0) AS debt
           FROM customers c
           LEFT JOIN ${ctTable} t
             ON t.customer_id = c.id
            AND t.status = 'pending'
            AND t.user_id = c.user_id
          WHERE c.user_id = ?
          GROUP BY c.id, c.name
          HAVING debt > 0
          ORDER BY debt DESC
          LIMIT 5`,
      )
        .bind(user.user_id)
        .all();

      topDebts = (q?.results ?? []).map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        debt: n(r.debt),
      }));
    }

    return json(
      {
        ok: true,
        counts,
        metrics: {
          currency: "EUR",
          revenue,
          expenses,
          expensesBreakdown: { suppliers: expensesSuppliers, payroll: expensesPayroll },
          netBalance,
          activeTransactionsCount,
          topDebts,
          topCustomers,
        },
      },
      200,
      cors(),
    );
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: String(err?.message ?? err),
        counts: { suppliers: 0, workplaces: 0, customers: 0, employees: 0 },
        metrics: {
          currency: "EUR",
          revenue: 0,
          expenses: 0,
          expensesBreakdown: { suppliers: 0, payroll: 0 },
          netBalance: 0,
          activeTransactionsCount: 0,
          topDebts: [],
          topCustomers: [],
        },
      },
      200,
      cors(),
    );
  }
}

function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}

function nextMonth(yyyyMM: string) {
  // yyyyMM like "2025-09"
  const d = new Date(`${yyyyMM}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7) + "-01";
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
