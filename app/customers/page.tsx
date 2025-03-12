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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Mail, Phone, Building2, Briefcase, DollarSign, Calendar, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { translations as t } from "@/lib/translations"

interface Customer {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  afm: string
  tractor: string
  notes: string
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

const initialCustomer: Customer = {
  id: "",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  afm: "",
  tractor: "",
  notes: "",
}

const initialTransaction: Transaction = {
  id: "",
  customerId: "",
  productName: "",
  amount: 0,
  amountPaid: 0,
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
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [isTransactionEditing, setIsTransactionEditing] = useState(false);

  useEffect(() => {
    const customersData = getLocalData("customers") || [];
    const transactionsData = getLocalData("transactions") || [];
    setCustomers(customersData);
    setTransactions(transactionsData);
  }, []);

  const columns = [
    { key: "name", label: t.customerName },
    { key: "contactPerson", label: t.contactPerson },
    { key: "email", label: t.email },
    { key: "address", label: t.address },
    { key: "phone", label: t.phone },
    { key: "afm", label: "AFM" },
    { key: "tractor", label: "Tractor" },
    { key: "debt", label: "Χρέη" },
  ]

  const handleAddNew = () => {
    setCurrentCustomer(initialCustomer)
    setIsEditing(false)
    setIsDialogOpen(true)
  }

  const handlePaymentSubmit = () => {
    // Calculate the remaining balance:
    const remaining = Number(currentTransaction.amount) - Number(currentTransaction.amountPaid);
    
    // Validate the payment amount:
    if (paymentAmount <= 0) {
      toast({
        title: "Error",
        description: "Payment amount must be greater than zero.",
        variant: "destructive",
      });
      return;
    }
    
    if (paymentAmount > remaining) {
      toast({
        title: "Error",
        description: "Payment amount cannot exceed the remaining balance.",
        variant: "destructive",
      });
      return;
    }
    
    // Update the transaction's amountPaid:
    const updatedTransaction = { ...currentTransaction };
    updatedTransaction.amountPaid += paymentAmount;
    
    // Automatically mark as paid if the transaction is fully settled:
    if (updatedTransaction.amountPaid >= updatedTransaction.amount) {
      updatedTransaction.status = "paid";
    }
    
    // Update the transactions list and local storage:
    const updatedTransactions = transactions.map((t) =>
      t.id === updatedTransaction.id ? updatedTransaction : t
    );
    setTransactions(updatedTransactions);
    setLocalData("transactions", updatedTransactions);
    
    toast({
      title: "Payment successful",
      description: "The payment has been recorded.",
    });
    
    // Close the Payment Dialog and reset paymentAmount:
    setIsPaymentDialogOpen(false);
    setPaymentAmount(0);
  };
  

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

  const handleDeleteTransaction = (transactionId: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      const updatedTransactions = transactions.filter((t) => t.id !== transactionId);
      setTransactions(updatedTransactions);
      setLocalData("transactions", updatedTransactions);
      toast({
        title: "Transaction Deleted",
        description: "The transaction has been successfully deleted.",
      });
    }
  };
  

  const getDebt = (customerId: string) => {
    return transactions
      .filter((t) => t.customerId === customerId && t.status === "pending")
      .reduce((sum, t) => sum + (t.amount - (t.amountPaid || 0)), 0);
  };
  
  const customersWithDebt = customers.map(customer => ({
    ...customer,
    debt: getDebt(customer.id),
  }));

  const handleEditTransaction = (transaction: Transaction) => {
    setCurrentTransaction(transaction);
    setIsTransactionEditing(true);
    setIsTransactionDialogOpen(true);
  };

  const handleOpenPaymentDialog = (transaction: Transaction) => {
    setCurrentTransaction(transaction);
    setPaymentAmount(0); // Reset previous payment value
    setIsPaymentDialogOpen(true);
  };
  

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
    if (!selectedCustomer) return;
    setCurrentTransaction({
      ...initialTransaction,
      customerId: selectedCustomer.id,
    });
    setIsTransactionEditing(false); // Reset the editing flag for new transactions
    setIsTransactionDialogOpen(true);
  }  

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!currentTransaction.productName || !currentTransaction.amount) {
      toast({
        title: "Σφάλμα",
        description: "Το όνομα του προϊόντος και το ποσό είναι υποχρεωτικά πεδία.",
        variant: "destructive",
      });
      return;
    }
  
    // Prepare the transaction object and update status if fully paid
    const transactionToSave = { ...currentTransaction };
    if (transactionToSave.amountPaid >= transactionToSave.amount) {
      transactionToSave.status = "paid";
    }
  
    if (isTransactionEditing) {
      // Update the existing transaction
      const updatedTransactions = transactions.map((t) =>
        t.id === transactionToSave.id ? transactionToSave : t
      );
      setTransactions(updatedTransactions);
      setLocalData("transactions", updatedTransactions);
      toast({
        title: "Η συναλλαγή ενημερώθηκε",
        description: "Η συναλλαγή ενημερώθηκε επιτυχώς.",
      });
      setIsTransactionEditing(false);
    } else {
      // Create a new transaction
      transactionToSave.id = generateId();
      const updatedTransactions = [...transactions, transactionToSave];
      setTransactions(updatedTransactions);
      setLocalData("transactions", updatedTransactions);
      toast({
        title: "Η συναλλαγή προστέθηκε",
        description: "Η συναλλαγή καταχωρήθηκε επιτυχώς.",
      });
    }
    setIsTransactionDialogOpen(false);
  };
   

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
          <h3 className="text-sm font-medium">{t.transactionHistory}</h3>
          <p className="text-sm text-muted-foreground">
            {t.totalSpent}: ${getTotalSpent(selectedCustomer?.id || "").toLocaleString()}
          </p>
        </div>
        <Button onClick={handleAddTransaction} size="sm">
          {t.addTransaction}
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
              <DollarSign className="h-4 w-4" />
              ${ (Number(transaction.amount) || 0).toLocaleString() }
            </div>
            {transaction.notes && <p className="text-sm text-muted-foreground mt-2">{transaction.notes}</p>}
            <p className="text-xs text-muted-foreground">
              Paid: ${ (Number(transaction.amountPaid) || 0).toLocaleString() } / ${ (Number(transaction.amount) || 0).toLocaleString() }
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="outline" onClick={() => handleEditTransaction(transaction)}>
              Edit
            </Button>
            {transaction.status === "pending" && transaction.amountPaid < transaction.amount && (
              <Button size="sm" variant="secondary" onClick={() => handleOpenPaymentDialog(transaction)}>
                Pay
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => handleDeleteTransaction(transaction.id)}>
              Delete
            </Button>
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
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">{t.details}</TabsTrigger>
            <TabsTrigger value="transactions">{t.transactions}</TabsTrigger>
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

            {(selectedCustomer?.afm || selectedCustomer?.tractor) && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Additional Information</h3>
                {selectedCustomer?.afm && (
                  <p className="text-sm text-muted-foreground">
                    <strong>ΑΦΜ:</strong> {selectedCustomer.afm}
                  </p>
                )}
                {selectedCustomer?.tractor && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Tractor:</strong> {selectedCustomer.tractor}
                  </p>
                )}
              </div>
            )}

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
        <h1 className="text-3xl font-bold tracking-tight">{t.customers}</h1>
        <p className="text-muted-foreground">{t.manageCustomers}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={customersWithDebt}
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
                <CardTitle>{t.noCustomerSelected}</CardTitle>
                <CardDescription>{t.selectCustomer}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click on a customer from the list to view their complete details, transaction history, and manage
                  their transactions.
                </p>
                <Button onClick={handleAddNew} className="mt-4 w-full">
                  {t.addNewCustomer}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? t.editCustomer : t.addNewCustomer}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.customerName} *</Label>
                  <Input
                    id="name"
                    value={currentCustomer.name}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">{t.contactPerson}</Label>
                  <Input
                    id="contactPerson"
                    value={currentCustomer.contactPerson}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, contactPerson: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={currentCustomer.email}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input
                    id="phone"
                    value={currentCustomer.phone}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t.address}</Label>
                <Input
                  id="address"
                  value={currentCustomer.address}
                  onChange={(e) => setCurrentCustomer({ ...currentCustomer, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="afm">ΑΦΜ</Label>
                  <Input
                    id="afm"
                    value={currentCustomer.afm}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, afm: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tractor">Τρακτέρ</Label>
                  <Input
                    id="tractor"
                    value={currentCustomer.tractor}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, tractor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Πληρωμή</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePaymentSubmit();
            }}
          >
            <div className="grid gap-4 py-4">
              <div>
                <p>
                  <strong>Προιόν:</strong> {currentTransaction.productName}
                </p>
                <p>
                  <strong>Συνολικό ποσό:</strong>{" "}
                  ${ (Number(currentTransaction.amount) || 0).toLocaleString() }
                </p>
                <p>
                  <strong>Πληρωμένο ποσό:</strong>{" "}
                  ${ (Number(currentTransaction.amountPaid) || 0).toLocaleString() }
                </p>
                <p>
                  <strong>Υπόλοιπο:</strong>{" "}
                  ${ (Number(currentTransaction.amount) - Number(currentTransaction.amountPaid) || 0).toLocaleString() }
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Ποσό πληρωμής</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  min="0"
                  max={currentTransaction.amount - currentTransaction.amountPaid}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number.parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Ακύρωση
              </Button>
              <Button type="submit">Πληρωμή</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isTransactionEditing ? "Ενημέρωση Συναλλαγής" : t.addTransaction}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransactionSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">{t.productName} *</Label>
                <Input
                  id="productName"
                  value={currentTransaction.productName}
                  onChange={(e) =>
                    setCurrentTransaction({
                      ...currentTransaction,
                      productName: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">{t.amount} *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentTransaction.amount}
                    onChange={(e) =>
                      setCurrentTransaction({
                        ...currentTransaction,
                        amount: Number.parseFloat(e.target.value),
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">{t.date}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={currentTransaction.date}
                    onChange={(e) =>
                      setCurrentTransaction({
                        ...currentTransaction,
                        date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              {/* New Partial Payment Input */}
              <div className="space-y-2">
                <Label htmlFor="amountPaid">Εξοφλημένο Ποσό</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentTransaction.amountPaid}
                  onChange={(e) =>
                    setCurrentTransaction({
                      ...currentTransaction,
                      amountPaid: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t.status}</Label>
                <Select
                  value={currentTransaction.status}
                  onValueChange={(value: "paid" | "pending" | "cancelled") =>
                    setCurrentTransaction({ ...currentTransaction, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε κατάσταση" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">{t.paid}</SelectItem>
                    <SelectItem value="pending">{t.pending}</SelectItem>
                    <SelectItem value="cancelled">{t.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={currentTransaction.notes}
                  onChange={(e) =>
                    setCurrentTransaction({
                      ...currentTransaction,
                      notes: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                Ακύρωση
              </Button>
              <Button type="submit">
                {isTransactionEditing ? "Αποθήκευση" : t.addTransaction}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
