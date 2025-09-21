// lib/api/dashboard/summary.ts
export type Counts = {
  suppliers: number;
  workplaces: number;
  customers: number;
  employees: number;
};

export type DebtItem = { id: string; name: string; debt: number };

export type Metrics = {
  currency: string;
  revenue: number;
  expenses: number;
  expensesBreakdown: { suppliers: number; payroll: number };
  netBalance: number;
  activeTransactionsCount: number;
  topDebts: DebtItem[];
};

export type DashboardSummaryResponse = {
  ok: boolean;
  error?: string;
  counts: Counts;
  metrics: Metrics;
};

const n = (x: any) => Number(x ?? 0) || 0;

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const res = await fetch("/api/dashboard/summary", {
    method: "GET",
    credentials: "include", // send session cookie
    cache: "no-store",
  });

  // If endpoint failed, return safe defaults
  if (!res.ok) {
    return {
      ok: false,
      error: `HTTP_${res.status}`,
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
    };
  }

  const json = await res.json();

  // Normalize and NaN-proof the payload (defensive)
  const c = json?.counts ?? {};
  const m = json?.metrics ?? {};

  return {
    ok: Boolean(json?.ok),
    error: json?.error,
    counts: {
      suppliers: n(c.suppliers),
      workplaces: n(c.workplaces),
      customers: n(c.customers),
      employees: n(c.employees),
    },
    metrics: {
      currency: String(m.currency || "EUR"),
      revenue: n(m.revenue),
      expenses: n(m.expenses),
      expensesBreakdown: {
        suppliers: n(m.expensesBreakdown?.suppliers),
        payroll: n(m.expensesBreakdown?.payroll),
      },
      netBalance: n(m.netBalance),
      activeTransactionsCount: n(m.activeTransactionsCount),
      topDebts: Array.isArray(m.topDebts)
        ? m.topDebts.map((d: any) => ({
            id: String(d.id),
            name: String(d.name),
            debt: n(d.debt),
          }))
        : [],
    },
  };
}
