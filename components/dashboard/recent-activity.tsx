"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ShoppingBag, Users, Building2, Briefcase } from "lucide-react"
import { translations as t } from "@/lib/translations"
import { getLocalData } from "@/lib/utils"

const iconMap: { [key: string]: React.ReactNode } = {
  users: <Users className="h-4 w-4" />,
  shoppingBag: <ShoppingBag className="h-4 w-4" />,
  briefcase: <Briefcase className="h-4 w-4" />,
  building2: <Building2 className="h-4 w-4" />,
};

export function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([])

  const loadActivities = () => {
    const stored = getLocalData("recentActivity") || [];
    setActivities(stored);
  };

  useEffect(() => {
    loadActivities();
    window.addEventListener("recentActivityUpdated", loadActivities);
    return () => window.removeEventListener("recentActivityUpdated", loadActivities);
  }, []);

  if (activities.length === 0) {
    return <div className="text-sm text-muted-foreground">No recent activity.</div>
  }

  return (
    <div className="space-y-4">
      {activities.map((activity: any) => (
        <div key={activity.id} className="flex items-center gap-4">
          <div className={`rounded-full p-2 ${activity.iconColor}`}>
            {iconMap[activity.iconKey] || null}
          </div>
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
