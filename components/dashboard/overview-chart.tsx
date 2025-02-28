"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { translations as t } from "@/lib/translations"

export function OverviewChart() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const data = [
    {
      name: t.months.jan,
      revenue: 4000,
      expenses: 2400,
    },
    {
      name: t.months.feb,
      revenue: 3002,
      expenses: 1398,
    },
    {
      name: t.months.mar,
      revenue: 2000,
      expenses: 1800,
    },
    {
      name: t.months.apr,
      revenue: 2780,
      expenses: 3908,
    },
    {
      name: t.months.may,
      revenue: 1890,
      expenses: 4800,
    },
    {
      name: t.months.jun,
      revenue: 2390,
      expenses: 3800,
    },
    {
      name: t.months.jul,
      revenue: 3490,
      expenses: 4300,
    },
    {
      name: t.months.aug,
      revenue: 4000,
      expenses: 2400,
    },
    {
      name: t.months.sep,
      revenue: 5000,
      expenses: 3398,
    },
    {
      name: t.months.oct,
      revenue: 6000,
      expenses: 4800,
    },
    {
      name: t.months.nov,
      revenue: 7000,
      expenses: 5800,
    },
    {
      name: t.months.dec,
      revenue: 9000,
      expenses: 6800,
    },
  ]

  if (!mounted) {
    return <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `€${value}`}
        />
        <Tooltip
          formatter={(value) => [`€${value}`, ""]}
          labelFormatter={(label) => `${t.months[label.toLowerCase()]}`}
        />
        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t.revenue} />
        <Bar dataKey="expenses" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name={t.expenses} />
      </BarChart>
    </ResponsiveContainer>
  )
}

