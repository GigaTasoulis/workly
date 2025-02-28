"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"

export function TopCustomers() {
  const customers = [
    {
      id: 1,
      name: "Acme Corporation",
      email: "contact@acme.com",
      value: 12500,
      maxValue: 15000,
      avatar: "/placeholder.svg",
    },
    {
      id: 2,
      name: "Globex Industries",
      email: "info@globex.com",
      value: 9800,
      maxValue: 15000,
      avatar: "/placeholder.svg",
    },
    {
      id: 3,
      name: "Stark Enterprises",
      email: "sales@stark.com",
      value: 7600,
      maxValue: 15000,
      avatar: "/placeholder.svg",
    },
    {
      id: 4,
      name: "Wayne Industries",
      email: "info@wayne.com",
      value: 6200,
      maxValue: 15000,
      avatar: "/placeholder.svg",
    },
  ]

  return (
    <div className="space-y-4">
      {customers.map((customer) => (
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
            <p className="text-sm font-medium">€{customer.value.toLocaleString()}</p>
          </div>
          <Progress value={(customer.value / customer.maxValue) * 100} className="h-2" />
        </div>
      ))}
    </div>
  )
}

