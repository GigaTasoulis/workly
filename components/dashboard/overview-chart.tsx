"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { translations as t } from "@/lib/translations";
import { getLocalData } from "@/lib/utils";

// Define interfaces matching your transactions (adjust if necessary)
interface Transaction {
  id: string;
  customerId: string;
  productName: string;
  amount: number;
  amountPaid: number;
  date: string;
  status: "paid" | "pending" | "cancelled";
  notes: string;
}

interface SupplierTransaction {
  id: string;
  supplierId: string;
  productName: string;
  amount: number;
  amountPaid: number;
  date: string;
  status: "paid" | "pending" | "cancelled";
  notes: string;
}

export function OverviewChart() {
  const [mounted, setMounted] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    setChartData(computeDashboardData());
  }, []);

  // Aggregation function: sums customer revenue and supplier expenses by month
  const computeDashboardData = () => {
    const monthKeys = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const monthsData = monthKeys.map((key) => ({
      name: t.months[key as keyof typeof t.months],
      revenue: 0,
      expenses: 0,
    }));

    // Get customer transactions from local storage
    const customerTransactions: Transaction[] = getLocalData("transactions") || [];
    customerTransactions.forEach((tr) => {
      const monthIndex = new Date(tr.date).getMonth();
      monthsData[monthIndex].revenue += tr.amountPaid;
    });

    // Get supplier transactions from local storage
    const supplierTransactions: SupplierTransaction[] = getLocalData("supplierTransactions") || [];
    supplierTransactions.forEach((tr) => {
      const monthIndex = new Date(tr.date).getMonth();
      monthsData[monthIndex].expenses += tr.amountPaid;
    });

    return monthsData;
  };

  if (!mounted) {
    return <div className="flex h-[300px] items-center justify-center">Loading chart...</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `€${value}`}
        />
        <Tooltip formatter={(value) => [`€${value}`, ""]} labelFormatter={(label) => label} />
        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t.revenue} />
        <Bar dataKey="expenses" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name={t.expenses} />
      </BarChart>
    </ResponsiveContainer>
  );
}
