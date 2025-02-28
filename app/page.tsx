import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Briefcase, ShoppingBag, DollarSign, Clock, BarChart } from "lucide-react"
import Link from "next/link"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { StatCard } from "@/components/dashboard/stat-card"
import { OverviewChart } from "@/components/dashboard/overview-chart"
import { TopCustomers } from "@/components/dashboard/top-customers"

export default function Home() {
  const modules = [
    {
      title: "Suppliers",
      description: "Manage your suppliers and vendor relationships",
      icon: <ShoppingBag className="h-8 w-8" />,
      href: "/suppliers",
      color: "bg-blue-100 dark:bg-blue-900",
      textColor: "text-blue-700 dark:text-blue-300",
      count: 24,
    },
    {
      title: "Workplaces",
      description: "Manage your office locations and work sites",
      icon: <Building2 className="h-8 w-8" />,
      href: "/workplaces",
      color: "bg-green-100 dark:bg-green-900",
      textColor: "text-green-700 dark:text-green-300",
      count: 8,
    },
    {
      title: "Customers",
      description: "Manage your customer relationships and data",
      icon: <Users className="h-8 w-8" />,
      href: "/customers",
      color: "bg-purple-100 dark:bg-purple-900",
      textColor: "text-purple-700 dark:text-purple-300",
      count: 156,
    },
    {
      title: "Employees",
      description: "Manage your team members and staff",
      icon: <Briefcase className="h-8 w-8" />,
      href: "/employees",
      color: "bg-amber-100 dark:bg-amber-900",
      textColor: "text-amber-700 dark:text-amber-300",
      count: 42,
    },
  ]

  const stats = [
    {
      title: "Total Revenue",
      value: "$45,231.89",
      description: "12% increase from last month",
      icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
      trend: "up",
    },
    {
      title: "New Customers",
      value: "12",
      description: "3 more than last week",
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
      trend: "up",
    },
    {
      title: "Active Projects",
      value: "24",
      description: "2 completed this week",
      icon: <BarChart className="h-4 w-4 text-muted-foreground" />,
      trend: "neutral",
    },
    {
      title: "Avg. Response Time",
      value: "3.2 hours",
      description: "14% faster than last month",
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      trend: "up",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Work-ly, your business management solution.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} stat={stat} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {modules.map((module) => (
          <Link key={module.title} href={module.href}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xl font-medium">{module.title}</CardTitle>
                <div className={`p-2 rounded-full ${module.color}`}>
                  <div className={module.textColor}>{module.icon}</div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{module.description}</CardDescription>
              </CardContent>
              <CardFooter>
                <p className="text-sm font-medium">{module.count} total</p>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Business performance over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <OverviewChart />
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates across your business</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>Your highest value customers</CardDescription>
          </CardHeader>
          <CardContent>
            <TopCustomers />
          </CardContent>
        </Card>
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Upcoming Tasks</CardTitle>
            <CardDescription>Tasks requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-md border p-4">
                <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
                  <Clock className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Supplier contract renewal</p>
                  <p className="text-sm text-muted-foreground">Office Supplies Inc. contract expires in 7 days</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-md border p-4">
                <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
                  <Users className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Employee onboarding</p>
                  <p className="text-sm text-muted-foreground">3 new employees starting next Monday</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-md border p-4">
                <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                  <Building2 className="h-4 w-4 text-green-700 dark:text-green-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Workplace inspection</p>
                  <p className="text-sm text-muted-foreground">Annual safety inspection for Downtown Office due</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

