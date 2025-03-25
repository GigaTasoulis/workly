"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { getLocalData } from "@/lib/utils"
import { Users } from "lucide-react"

interface Customer {
  id: string
  name: string
  avatar?: string
}

interface Transaction {
  id: string
  customerId: string
  productName: string
  amount: number
  amountPaid: number
  date: string
  status: "paid" | "pending" | "cancelled"
  notes: string
}

export function TopDebts() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    setCustomers(getLocalData("customers") || [])
    setTransactions(getLocalData("transactions") || [])
  }, [])

  const pendingTransactions = transactions
    .filter((tr) => tr.status === "pending")
    .map((tr) => ({
      ...tr,
      remaining: (tr.amount || 0) - (tr.amountPaid || 0),
    }))
    .filter((tr) => tr.remaining > 0)

  const topDebts = [...pendingTransactions]
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {topDebts.map((tx) => {
        const cust = customers.find((c) => c.id === tx.customerId)
        return (
          <div key={tx.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={cust?.avatar} alt={cust?.name} />
                  <AvatarFallback>{cust ? cust.name.charAt(0) : "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{tx.productName}</p>
                  <p className="text-xs text-muted-foreground">{tx.date}</p>
                  <p className="text-xs text-muted-foreground">
                    Πελάτης: {cust ? cust.name : "Unknown"}
                  </p>
                </div>
              </div>
              <div className="text-sm font-medium">
                €{tx.remaining.toLocaleString()} / €{tx.amount.toLocaleString()}
              </div>
            </div>
            <Progress value={(tx.amountPaid / tx.amount) * 100} className="h-2" />
          </div>
        )
      })}
    </div>
  )
}
