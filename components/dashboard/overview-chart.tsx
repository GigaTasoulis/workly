"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function OverviewChart() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const data = [
    {
      name: "Jan",
      revenue: 4000,
      expenses: 2400,
    },
    {
      name: "Feb",
      revenue: 3000,
      expenses: 1398,
    },
    {
      name: "Mar",
      revenue: 2000,
      expenses: 1800,
    },
    {
      name: "Apr",
      revenue: 2780,
      expenses: 3908,
    },
    {
      name: "May",
      revenue: 1890,
      expenses: 4800,
    },
    {
      name: "Jun",
      revenue: 2390,
      expenses: 3800,
    },
    {
      name: "Jul",
      revenue: 3490,
      expenses: 4300,
    },
    {
      name: "Aug",
      revenue: 4000,
      expenses: 2400,
    },
    {
      name: "Sep",
      revenue: 5000,
      expenses: 3398,
    },
    {
      name: "Oct",
      revenue: 6000,
      expenses: 4800,
    },
    {
      name: "Nov",
      revenue: 7000,
      expenses: 5800,
    },
    {
      name: "Dec",
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
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip formatter={(value) => [`$${value}`, ""]} labelFormatter={(label) => `Month: ${label}`} />
        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
        <Bar dataKey="expenses" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Expenses" />
      </BarChart>
    </ResponsiveContainer>
  )
}

