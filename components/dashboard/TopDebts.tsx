"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { getLocalData } from "@/lib/utils"

type DebtItem = { id: string; name: string; debt: number; avatar?: string }

export function TopDebts({ items }: { items?: DebtItem[] }) {
  const [data, setData] = useState<DebtItem[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 1) If parent provided items, use them
      if (Array.isArray(items)) {
        setData(items)
        return
      }

      // 2) Try API (summary endpoint)
      try {
        const res = await fetch("/api/dashboard/summary", {
          credentials: "include",
          cache: "no-store",
        })
        const json = await res.json()
        const apiItems = json?.metrics?.topDebts
        if (!cancelled && Array.isArray(apiItems)) {
          setData(
            apiItems.map((d: any) => ({
              id: String(d.id),
              name: String(d.name),
              debt: Number(d.debt) || 0,
            }))
          )
          return
        }
      } catch {
        // ignore and fall back
      }

      // 3) Fallback to local (legacy behavior)
      try {
        const customers = getLocalData("customers") || []
        const transactions = getLocalData("transactions") || []
        const debts = customers
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            debt: (transactions || [])
              .filter((tr: any) => tr.customerId === c.id && tr.status === "pending")
              .reduce(
                (sum: number, tr: any) =>
                  sum + ((Number(tr.amount) || 0) - (Number(tr.amountPaid) || 0)),
                0
              ),
          }))
          .filter((c: any) => c.debt > 0)
          .sort((a: any, b: any) => b.debt - a.debt)
          .slice(0, 5)

        if (!cancelled) setData(debts)
      } catch {
        // leave empty
      }
    })()

    return () => {
      cancelled = true
    }
  }, [items])

  const maxDebt = useMemo(
    () => data.reduce((m, d) => (d.debt > m ? d.debt : m), 0) || 1,
    [data]
  )

  return (
    <div className="space-y-4">
      {data.map((c) => {
        const pct = Math.max(0, Math.min(100, (Number(c.debt) / maxDebt) * 100))
        return (
          <div key={c.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {c.avatar ? <AvatarImage src={c.avatar} alt={c.name} /> : null}
                  <AvatarFallback>{c.name?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Οφειλή</p>
                </div>
              </div>
              <div className="text-sm font-medium">€{(Number(c.debt) || 0).toLocaleString()}</div>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        )
      })}
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground">Δεν υπάρχουν εκκρεμείς οφειλές.</p>
      )}
    </div>
  )
}
