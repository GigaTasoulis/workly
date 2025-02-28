import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Work-ly | Διαχείριση Επιχείρησης",
  description: "Διαχειριστείτε αποτελεσματικά τα δεδομένα της επιχείρησής σας",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900 w-full">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  )
}

