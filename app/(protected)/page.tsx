// @ts-nocheck
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Building2,
  Users,
  Briefcase,
  ShoppingBag,
  DollarSign,
  BarChart,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { StatCard } from "@/components/dashboard/stat-card"
import { OverviewChart } from "@/components/dashboard/overview-chart"
import { TopCustomers } from "@/components/dashboard/top-customers"
import { TopDebts } from "@/components/dashboard/TopDebts"
import { translations as t } from "@/lib/translations"
import RequireAuth from "@/components/RequireAuth"

// ---- small helper so all math is NaN-safe
const n = (x: any) => Number(x ?? 0) || 0

// Optional: type hints for clarity (kept minimal due to // @ts-nocheck)
type Counts = { suppliers: number; workplaces: number; customers: number; employees: number }
type DebtItem = { id: string; name: string; debt: number }
type Metrics = {
  currency: string
  revenue: number
  expenses: number
  expensesBreakdown: { suppliers: number; payroll: number }
  netBalance: number
  activeTransactionsCount: number
  topDebts: DebtItem[]
}

export default function Home() {
  // Counts
  const [counts, setCounts] = useState<Counts>({
    suppliers: 0,
    workplaces: 0,
    customers: 0,
    employees: 0,
  })

  // Metrics
  const [metrics, setMetrics] = useState<Metrics>({
    currency: "EUR",
    revenue: 0,
    expenses: 0,
    expensesBreakdown: { suppliers: 0, payroll: 0 },
    netBalance: 0,
    activeTransactionsCount: 0,
    topDebts: [],
  })

  // ----- Config-driven modules (no hardcoded numbers)
  const modules = useMemo(
    () => [
      {
        title: t.suppliers,
        description: t.manageSuppliers,
        icon: <ShoppingBag className="h-8 w-8" />,
        href: "/suppliers",
        color: "bg-blue-100 dark:bg-blue-900",
        textColor: "text-blue-700 dark:text-blue-300",
        count: counts.suppliers,
      },
      {
        title: t.workplaces,
        description: t.manageWorkplaces,
        icon: <Building2 className="h-8 w-8" />,
        href: "/workplaces",
        color: "bg-green-100 dark:bg-green-900",
        textColor: "text-green-700 dark:text-green-300",
        count: counts.workplaces,
      },
      {
        title: t.customers,
        description: t.manageCustomers,
        icon: <Users className="h-8 w-8" />,
        href: "/customers",
        color: "bg-purple-100 dark:bg-purple-900",
        textColor: "text-purple-700 dark:text-purple-300",
        count: counts.customers,
      },
      {
        title: t.employees,
        description: t.manageEmployees,
        icon: <Briefcase className="h-8 w-8" />,
        href: "/employees",
        color: "bg-amber-100 dark:bg-amber-900",
        textColor: "text-amber-700 dark:text-amber-300",
        count: counts.employees,
      },
    ],
    [counts]
  )

  // ----- Config-driven stat cards (revenue/expenses/net/pending)
  const stats = useMemo(
    () => [
      {
        title: t.totalRevenue || "Συνολικά Έσοδα",
        value: `€${metrics.revenue.toLocaleString()}`,
        description: `${t.paidTotal ?? "Συνολικά πληρώθηκαν"}: €${metrics.revenue.toLocaleString()}`,
        icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
        trend: metrics.revenue > 0 ? "up" : "neutral",
      },
      {
        title: t.activeTransactions || "Ενεργές συναλλαγές",
        value: `${metrics.activeTransactionsCount}`,
        description:
          metrics.activeTransactionsCount > 0
            ? `${metrics.activeTransactionsCount} ${t.pending ?? "εκρεμμούν"}`
            : "",
        icon: <BarChart className="h-4 w-4 text-muted-foreground" />,
        trend: "neutral",
      },
      {
        title: t.totalExpenses || "Συνολικά Έξοδα",
        value: `€${metrics.expenses.toLocaleString()}`,
        description: `${t.remainingDebts ?? "Υπόλοιπα χρέη"}: €${metrics.expenses.toLocaleString()}`,
        icon: <TrendingDown className="h-4 w-4 text-red-500" />,
        trend: metrics.expenses > 0 ? "down" : "neutral",
      },
      {
        title: t.netBalance || "Καθαρό Υπόλοιπο",
        value: `€${metrics.netBalance.toLocaleString()}`,
        description:
          metrics.netBalance >= 0 ? (t.profitable ?? "Κερδοφόρο") : (t.loss ?? "Ζημιογόνο"),
        icon:
          metrics.netBalance >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          ),
        trend: metrics.netBalance > 0 ? "up" : metrics.netBalance < 0 ? "down" : "neutral",
      },
    ],
    [metrics]
  )

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/dashboard/summary", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })
        const json = await res.json()
        if (cancelled) return

        const c = json?.counts ?? {}
        const m = json?.metrics ?? {}

        setCounts({
          suppliers: n(c.suppliers),
          workplaces: n(c.workplaces),
          customers: n(c.customers),
          employees: n(c.employees),
        })

        setMetrics({
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
        })
      } catch {
        // leave defaults; UI stays usable
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.dashboard}</h1>
          <p className="text-muted-foreground">
            {t.welcome}, {t.businessManagementSolution}.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} stat={stat} />
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <Link key={module.title} href={module.href}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xl font-medium">{module.title}</CardTitle>
                  <div className={`p-2 rounded-full ${module.color}`}>
                    <div className={module.textColor}>{module.icon}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{module.description}</CardDescription>
                </CardContent>
                <CardFooter>
                  <p className="text-sm font-medium">
                    {module.count} {t.total}
                  </p>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-7">
          <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle>{t.overview}</CardTitle>
              <CardDescription>{t.businessPerformance}</CardDescription>
            </CardHeader>
            <CardContent>
              <OverviewChart />
            </CardContent>
          </Card>
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>{t.recentActivity}</CardTitle>
              <CardDescription>{t.latestUpdates}</CardDescription>
            </CardHeader>
            <CardContent>
              <RecentActivity />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-7">
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>{t.topCustomers}</CardTitle>
              <CardDescription>{t.highestValueCustomers}</CardDescription>
            </CardHeader>
            <CardContent>
              <TopCustomers />
            </CardContent>
          </Card>
          <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle>Μεγαλύτερα Χρέη</CardTitle>
              <CardDescription>Οι συναλλαγές με τα μεγαλύτερα υπόλοιπα</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Pass data from API so TopDebts becomes data-driven */}
              <TopDebts items={metrics.topDebts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </RequireAuth>
  )
}
