"use client";

import { useEffect, useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { getLocalData } from "@/lib/utils";

type TopCustomerItem = {
  id: string;
  name: string;
  email?: string;
  revenue: number;
  avatar?: string;
};

type LocalCustomer = { id: string; name: string; email?: string; avatar?: string };
type LocalTx = {
  id: string;
  customerId: string;
  productName: string;
  amount: number;
  amountPaid: number;
  date: string;
  status: "paid" | "pending" | "cancelled";
  notes: string;
};

export function TopCustomers({ items }: { items?: TopCustomerItem[] }) {
  const [data, setData] = useState<TopCustomerItem[]>([]);

  useEffect(() => {
    // 1) Use items from parent (API-driven)
    if (Array.isArray(items) && items.length) {
      setData(items);
      return;
    }

    // 2) Fallback to local storage (legacy)
    try {
      const customers: LocalCustomer[] = getLocalData("customers") || [];
      const txs: LocalTx[] = getLocalData("transactions") || [];

      const rows: TopCustomerItem[] = customers.map((c) => {
        const revenue = txs
          .filter((t) => t.customerId === c.id)
          .reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
        return { id: c.id, name: c.name, email: c.email || "", avatar: c.avatar, revenue };
      });

      rows.sort((a, b) => b.revenue - a.revenue);
      setData(rows.slice(0, 4));
    } catch {
      setData([]);
    }
  }, [items]);

  const maxValue = useMemo(
    () => data.reduce((m, c) => (c.revenue > m ? c.revenue : m), 0) || 1,
    [data],
  );

  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Δεν υπάρχουν δεδομένα πελατών.</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((customer) => (
        <div key={customer.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {customer.avatar ? <AvatarImage src={customer.avatar} alt={customer.name} /> : null}
                <AvatarFallback>{customer.name?.charAt(0) ?? "?"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{customer.name}</p>
                {customer.email ? (
                  <p className="text-xs text-muted-foreground">{customer.email}</p>
                ) : null}
              </div>
            </div>
            <p className="text-sm font-medium">
              €{(Number(customer.revenue) || 0).toLocaleString()}
            </p>
          </div>
          <Progress
            value={Math.max(0, Math.min(100, (Number(customer.revenue) / maxValue) * 100))}
            className="h-2"
          />
        </div>
      ))}
    </div>
  );
}
