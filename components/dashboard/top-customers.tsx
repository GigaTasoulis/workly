"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { getLocalData } from "@/lib/utils"

interface Customer {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

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

export function TopCustomers() {
  // Load customers and transactions dynamically
  const customers: Customer[] = getLocalData("customers") || []
  const transactions: Transaction[] = getLocalData("transactions") || []

  // Compute revenue per customer (using amountPaid)
  const customerRevenue = customers.map((customer) => {
    const revenue = transactions
      .filter((tr) => tr.customerId === customer.id)
      .reduce((sum, tr) => sum + tr.amountPaid, 0)
    return { ...customer, revenue }
  })

  // Sort customers descending by revenue and take top 4
  const topCustomers = customerRevenue.sort((a, b) => b.revenue - a.revenue).slice(0, 4)

  // Use the highest revenue value as a scaling factor for the progress bar
  const maxValue = topCustomers.reduce((max, c) => (c.revenue > max ? c.revenue : max), 1)

  return (
    <div className="space-y-4">
      {topCustomers.map((customer) => (
        <div key={customer.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={customer.avatar} alt={customer.name} />
                <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.email}</p>
              </div>
            </div>
            <p className="text-sm font-medium">€{customer.revenue.toLocaleString()}</p>
          </div>
          <Progress value={(customer.revenue / maxValue) * 100} className="h-2" />
        </div>
      ))}
    </div>
  )
}
