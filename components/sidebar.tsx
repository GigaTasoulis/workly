"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Users, Briefcase, ShoppingBag, LayoutDashboard, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { translations as t } from "@/lib/translations"
import ThemeToggleButton from "@/components/ThemeToggleButton"

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const routes = [
    {
      name: t.dashboard,
      path: "/",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: t.suppliers,
      path: "/suppliers",
      icon: <ShoppingBag className="h-5 w-5" />,
    },
    {
      name: t.workplaces,
      path: "/workplaces",
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      name: t.customers,
      path: "/customers",
      icon: <Users className="h-5 w-5" />,
    },
    {
      name: t.employees,
      path: "/employees",
      icon: <Briefcase className="h-5 w-5" />,
    },
  ]

  return (
    <>
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setIsOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div
        className={cn("fixed inset-0 z-40 bg-black/80 md:hidden", isOpen ? "block" : "hidden")}
        onClick={() => setIsOpen(false)}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:w-64 border-r",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <Link href="/" className="flex items-center">
            <span className="text-xl font-bold">Work-ly</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="md:hidden">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="p-4 space-y-1">
          {routes.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === route.path
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
              )}
            >
              {route.icon}
              {route.name}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <ThemeToggleButton />
        </div>
      </div>
    </>
  )
}

