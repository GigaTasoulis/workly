"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ShoppingBag, Users, Building2, Briefcase } from "lucide-react"

export function RecentActivity() {
  const activities = [
    {
      id: 1,
      type: "customer",
      action: "New customer added",
      name: "Acme Corporation",
      time: "2 hours ago",
      icon: <Users className="h-4 w-4" />,
      iconColor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      avatar: "/placeholder.svg",
    },
    {
      id: 2,
      type: "supplier",
      action: "Updated supplier details",
      name: "Tech Solutions Inc.",
      time: "4 hours ago",
      icon: <ShoppingBag className="h-4 w-4" />,
      iconColor: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      avatar: "/placeholder.svg",
    },
    {
      id: 3,
      type: "employee",
      action: "Employee status changed",
      name: "Sarah Johnson",
      time: "Yesterday",
      icon: <Briefcase className="h-4 w-4" />,
      iconColor: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      avatar: "/placeholder.svg",
    },
    {
      id: 4,
      type: "workplace",
      action: "New workplace added",
      name: "Downtown Office",
      time: "2 days ago",
      icon: <Building2 className="h-4 w-4" />,
      iconColor: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      avatar: "/placeholder.svg",
    },
  ]

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center gap-4">
          <div className={`rounded-full p-2 ${activity.iconColor}`}>{activity.icon}</div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{activity.action}</p>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={activity.avatar} alt={activity.name} />
                <AvatarFallback>{activity.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="text-xs text-muted-foreground">{activity.name}</p>
              <p className="text-xs text-muted-foreground">•</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

