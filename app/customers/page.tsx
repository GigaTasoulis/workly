"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { generateId, getLocalData, setLocalData } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Phone, Building2, Briefcase, DollarSign, Calendar, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"

interface Customer {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  industry: string
  notes: string
}

interface Transaction {
  id: string
  customerId: string
  productName: string
  amount: number
  date: string
  status: "paid" | "pending" | "cancelled"
  notes: string
}

const initialCustomer: Customer = {
  id: "",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  industry: "",
  notes: "",
}

const initialTransaction: Transaction = {
  id: "",
  customerId: "",
  productName: "",
  amount: 0,
  date: new Date().toISOString().split("T")[0],
  status: "pending",
  notes: "",
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(initialCustomer)
  const [currentTransaction, setCurrentTransaction] = useState<Transaction>(initialTransaction)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const customersData = getLocalData("customers")
    const transactionsData = getLocalData("transactions")
    setCustomers(customersData)
    setTransactions(transactionsData)
  }, [])

  const columns = [
    { key: "name", label: "Name" },
    { key: "contactPerson", label: "Contact Person" },
    { key: "email", label: "Email" },
    { key: "industry", label: "Industry" },
  ]

  const handleAddNew = () => {
    setCurrentCustomer(initialCustomer)
    setIsEditing(false)
    setIsDialogOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setCurrentCustomer(customer)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const updatedCustomers = customers.filter((customer) => customer.id !== id)
    setCustomers(updatedCustomers)
    setLocalData("customers", updatedCustomers)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentCustomer.name || !currentCustomer.email) {
      toast({
        title: "Error",
        description: "Name and email are required fields.",
        variant: "destructive",
      })
      return
    }

    let updatedCustomers: Customer[]

    if (isEditing) {
      updatedCustomers = customers.map((customer) => (customer.id === currentCustomer.id ? currentCustomer : customer))
      toast({
        title: "Customer updated",
        description: "The customer has been successfully updated.",
      })
    } else {
      const newCustomer = {
        ...currentCustomer,
        id: generateId(),
      }
      updatedCustomers = [...customers, newCustomer]
      toast({
        title: "Customer added",
        description: "The customer has been successfully added.",
      })
    }

    setCustomers(updatedCustomers)
    setLocalData("customers", updatedCustomers)
    setIsDialogOpen(false)
  }

  const handleAddTransaction = () => {
    if (!selectedCustomer) return
    setCurrentTransaction({
      ...initialTransaction,
      customerId: selectedCustomer.id,
    })
    setIsTransactionDialogOpen(true)
  }

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentTransaction.productName || !currentTransaction.amount) {
      toast({
        title: "Error",
        description: "Product name and amount are required fields.",
        variant: "destructive",
      })
      return
    }

    const newTransaction = {
      ...currentTransaction,
      id: generateId(),
      amount: Number(currentTransaction.amount),
    }

    const updatedTransactions = [...transactions, newTransaction]
    setTransactions(updatedTransactions)
    setLocalData("transactions", updatedTransactions)
    setIsTransactionDialogOpen(false)

    toast({
      title: "Transaction added",
      description: "The transaction has been successfully recorded.",
    })
  }

  const getCustomerTransactions = (customerId: string) => {
    return transactions
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const getTotalSpent = (customerId: string) => {
    return transactions
      .filter((t) => t.customerId === customerId && t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
    }
  }

  const renderTransactionsTab = () => (
    <TabsContent value="transactions" className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium">Transaction History</h3>
          <p className="text-sm text-muted-foreground">
            Total spent: ${getTotalSpent(selectedCustomer?.id || "").toLocaleString()}
          </p>
        </div>
        <Button onClick={handleAddTransaction} size="sm">
          Add Transaction
        </Button>
      </div>
      <div className="space-y-4">
        {getCustomerTransactions(selectedCustomer?.id || "").map((transaction) => (
          <div key={transaction.id} className="flex items-start gap-4 rounded-md border p-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">{transaction.productName}</p>
                <Badge variant="outline" className={getStatusColor(transaction.status)}>
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(new Date(transaction.date), "MMM d, yyyy")}
                <span>•</span>
                <DollarSign className="h-4 w-4" />${transaction.amount.toLocaleString()}
              </div>
              {transaction.notes && <p className="text-sm text-muted-foreground mt-2">{transaction.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </TabsContent>
  )

  const renderCustomerCard = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{selectedCustomer?.name}</CardTitle>
            <CardDescription>Customer Details</CardDescription>
          </div>
          <Badge variant="outline" className="ml-2">
            <Briefcase className="h-3 w-3 mr-1" />
            {selectedCustomer?.industry}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Contact Information</h3>
              <div className="grid gap-2">
                <div className="flex items-center text-sm">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  {selectedCustomer?.email}
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  {selectedCustomer?.phone || "Not provided"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Address</h3>
              <div className="flex items-center text-sm">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                {selectedCustomer?.address || "Not provided"}
              </div>
            </div>

            {selectedCustomer?.notes && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Notes</h3>
                <div className="flex items-start text-sm">
                  <FileText className="h-4 w-4 mr-2 text-muted-foreground mt-0.5" />
                  <span>{selectedCustomer.notes}</span>
                </div>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => handleEdit(selectedCustomer)} className="flex-1">
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this customer?")) {
                    handleDelete(selectedCustomer.id)
                  }
                }}
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          </TabsContent>

          {renderTransactionsTab()}
        </Tabs>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">Manage your customer relationships and data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={customers}
            onAdd={handleAddNew}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSelect={setSelectedCustomer}
          />
        </div>

        <div>
          {selectedCustomer ? (
            renderCustomerCard()
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Customer Selected</CardTitle>
                <CardDescription>Select a customer to view details</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click on a customer from the list to view their complete details, transaction history, and manage
                  their transactions.
                </p>
                <Button onClick={handleAddNew} className="mt-4 w-full">
                  Add New Customer
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={currentCustomer.name}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={currentCustomer.contactPerson}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, contactPerson: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={currentCustomer.email}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={currentCustomer.phone}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={currentCustomer.address}
                  onChange={(e) => setCurrentCustomer({ ...currentCustomer, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={currentCustomer.industry}
                  onChange={(e) => setCurrentCustomer({ ...currentCustomer, industry: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={currentCustomer.notes}
                  onChange={(e) => setCurrentCustomer({ ...currentCustomer, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransactionSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  value={currentTransaction.productName}
                  onChange={(e) => setCurrentTransaction({ ...currentTransaction, productName: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentTransaction.amount}
                    onChange={(e) =>
                      setCurrentTransaction({ ...currentTransaction, amount: Number.parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={currentTransaction.date}
                    onChange={(e) => setCurrentTransaction({ ...currentTransaction, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={currentTransaction.status}
                  onValueChange={(value: "paid" | "pending" | "cancelled") =>
                    setCurrentTransaction({ ...currentTransaction, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={currentTransaction.notes}
                  onChange={(e) => setCurrentTransaction({ ...currentTransaction, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Transaction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

