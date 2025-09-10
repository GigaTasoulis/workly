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
  
    // helpers
    const n = (x: any) => (Number(x ?? 0) || 0);
    const hasTable = async (name: string) => {
      const r = await env.DB.prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
      ).bind(name).first();
      return !!r;
    };
    const safeFirst = async (sql: string, binds: any[]) => {
      try {
        return await env.DB.prepare(sql).bind(...binds).first();
      } catch (e: any) {
        if (String(e?.message || e).toLowerCase().includes("no such table")) return null;
        throw e;
      }
    };
  
    try {
      // ---------- COUNTS ----------
      const [sup, wp, cust, emp] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS c FROM suppliers  WHERE user_id = ?").bind(user.user_id).first(),
        env.DB.prepare("SELECT COUNT(*) AS c FROM workplaces WHERE user_id = ?").bind(user.user_id).first(),
        env.DB.prepare("SELECT COUNT(*) AS c FROM customers  WHERE user_id = ?").bind(user.user_id).first(),
        env.DB.prepare("SELECT COUNT(*) AS c FROM employees  WHERE user_id = ?").bind(user.user_id).first(),
      ]);
      const counts = {
        suppliers:  n(sup?.c),
        workplaces: n(wp?.c),
        customers:  n(cust?.c),
        employees:  n(emp?.c),
      };
  
      // ---------- TABLE EXISTENCE ----------
      const hasCT = await hasTable("customer_transactions");
      const hasST = await hasTable("supplier_transactions");
      const hasPT = await hasTable("payroll_transactions");
  
      // ---------- FINANCIALS ----------
      // Revenue = sum(amount_paid) from customer_transactions
      const revRow = hasCT
        ? await safeFirst(
            "SELECT COALESCE(SUM(amount_paid), 0) AS v FROM customer_transactions WHERE user_id = ?",
            [user.user_id]
          )
        : null;
      const revenue = n(revRow?.v);
  
      // Expenses = suppliers + payroll (sum of amount_paid)
      const expSup = hasST
        ? await safeFirst(
            "SELECT COALESCE(SUM(amount_paid), 0) AS v FROM supplier_transactions WHERE user_id = ?",
            [user.user_id]
          )
        : null;
      const expensesSuppliers = n(expSup?.v);
  
      const expPay = hasPT
        ? await safeFirst(
            "SELECT COALESCE(SUM(amount_paid), 0) AS v FROM payroll_transactions WHERE user_id = ?",
            [user.user_id]
          )
        : null;
      const expensesPayroll = n(expPay?.v);
  
      const expenses = n(expensesSuppliers + expensesPayroll);
      const netBalance = n(revenue - expenses);
  
      // ---------- ACTIVE TRANSACTIONS (status='pending') ----------
      const pCust = hasCT
        ? await safeFirst(
            "SELECT COUNT(*) AS c FROM customer_transactions WHERE user_id = ? AND status = 'pending'",
            [user.user_id]
          )
        : null;
      const pSup = hasST
        ? await safeFirst(
            "SELECT COUNT(*) AS c FROM supplier_transactions WHERE user_id = ? AND status = 'pending'",
            [user.user_id]
          )
        : null;
      const pPay = hasPT
        ? await safeFirst(
            "SELECT COUNT(*) AS c FROM payroll_transactions WHERE user_id = ? AND status = 'pending'",
            [user.user_id]
          )
        : null;
  
      const activeTransactionsCount = n(pCust?.c) + n(pSup?.c) + n(pPay?.c);
  
      // ---------- TOP DEBTS (customers only) ----------
      let topDebts: Array<{ id: string; name: string; debt: number }> = [];
      if (hasCT) {
        const q = await env.DB.prepare(
          `SELECT c.id AS id, c.name AS name,
                  COALESCE(SUM(COALESCE(ct.amount,0) - COALESCE(ct.amount_paid,0)), 0) AS debt
           FROM customers c
           LEFT JOIN customer_transactions ct
             ON ct.customer_id = c.id
            AND ct.status = 'pending'
            AND ct.user_id = c.user_id
           WHERE c.user_id = ?
           GROUP BY c.id, c.name
           HAVING debt > 0
           ORDER BY debt DESC
           LIMIT 5`
        ).bind(user.user_id).all();
  
        topDebts = (q?.results ?? []).map((r: any) => ({
          id: String(r.id),
          name: String(r.name),
          debt: n(r.debt),
        }));
      }
  
      return json({
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
        },
      }, 200, cors());
    } catch (err: any) {
      return json({
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
        },
      }, 200, cors());
    }
  }
  
  function json(data: any, status = 200, headers?: Record<string, string>) {
    return new Response(JSON.stringify(data), { status, headers });
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
  