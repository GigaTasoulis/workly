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
import { generateId, getLocalData, setLocalData, logActivity } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Mail, Phone, Building2, Briefcase, DollarSign, Calendar, FileText, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TransactionList } from "@/components/TransactionList"
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

interface Payment {
  id: string;
  transactionId: string;
  customerId: string;
  productName: string;
  paymentAmount: number;
  paymentDate: string; // e.g., "2025-03-25"
  notes?: string;
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
  const [transactionFilter, setTransactionFilter] = useState<"all" | "paid" | "pending">("all");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentHistoryCustomerFilter, setPaymentHistoryCustomerFilter] = useState<string>("all");
  const [paymentHistorySortOrder, setPaymentHistorySortOrder] = useState<string>("desc");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [currentPaymentPage, setCurrentPaymentPage] = useState(1);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const paymentsPerPage = 10;
  




  useEffect(() => {
    const customersData = getLocalData("customers") || [];
    const transactionsData = getLocalData("transactions") || [];
    const storedPayments = getLocalData("payments") || [];
    setCustomers(customersData);
    setTransactions(transactionsData);
    setPayments(storedPayments);
  }, []);

  const columns = [
    { key: "name", label: t.customerName },
    { key: "contactPerson", label: t.contactPerson },
    { key: "email", label: t.email },
    { key: "address", label: t.address },
    { key: "phone", label: t.phone },
    { key: "afm", label: "ΑΦΜ" },
    { key: "tractor", label: "Τρακτέρ" },
    { key: "debt", label: "Όφειλές" },
  ]

  const handleAddNew = () => {
    setCurrentCustomer(initialCustomer)
    setIsEditing(false)
    setIsDialogOpen(true)
  }

  const handlePaymentSubmit = () => {
    const newPayment: Payment = {
      id: generateId(),
      transactionId: currentTransaction.id,
      customerId: currentTransaction.customerId,
      productName: currentTransaction.productName,
      paymentAmount: paymentAmount, 
      paymentDate: paymentDate,
      notes: paymentNotes,
    };
    const updatedPayments = [...payments, newPayment];
    setPayments(updatedPayments);
    setLocalData("payments", updatedPayments);

    const remaining = Number(currentTransaction.amount) - Number(currentTransaction.amountPaid);
    
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
    if (updatedTransaction.amountPaid >= updatedTransaction.amount) {
      updatedTransaction.status = "paid";
    }
    
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
    setPaymentDate(new Date().toISOString().split("T")[0]);
    logActivity({
      type: "transaction",
      action: t.transactionPaid, 
      name: currentTransaction.productName,
      time: "Just now",
      iconKey: "euroSign", 
      iconColor: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    });    
    
    
  };
  

  const handleEdit = (customer: Customer) => {
    setCurrentCustomer(customer)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const deletedName = selectedCustomer ? selectedCustomer.name : "";
    const updatedCustomers = customers.filter((customer) => customer.id !== id)
    setCustomers(updatedCustomers)
    setLocalData("customers", updatedCustomers)
    logActivity({
      type: "customer",
      action: t.customerDeleted,
      name: deletedName,
      time: "Just now",
      iconKey: "users",
      iconColor: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      avatar: "/placeholder.svg",
    });
    
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

    if (!currentCustomer.name) {
      toast({
        title: "Error",
        description: "Name is a required field.",
        variant: "destructive",
      })
      return
    }

    if (!isEditing) {
      logActivity({
        type: "customer",
        action: t.newCustomerAdded,
        name: currentCustomer.name,
        time: "Just now",
        iconKey: "users", 
        iconColor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
        avatar: "/placeholder.svg",
      });      
    } else {
      logActivity({
        type: "customer",
        action: t.customerUpdated,
        name: currentCustomer.name,
        time: "Just now",
        iconKey: "users",
        iconColor: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
        avatar: "/placeholder.svg",
      });
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
    let filtered = transactions.filter((t) => t.customerId === customerId);
    if (transactionFilter !== "all") {
      filtered = filtered.filter((t) => t.status === transactionFilter);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getTotalSpent = (customerId: string) => {
    return transactions
      .filter((t) => t.customerId === customerId)
      .reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
  };  

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
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-medium">{t.transactionHistory}</h3>
          <p className="text-sm text-muted-foreground">
            {t.totalSpent}: €{getTotalSpent(selectedCustomer?.id || "").toLocaleString()}
          </p>
        </div>
        <Button onClick={handleAddTransaction} size="sm">
          {t.addTransaction}
        </Button>
      </div>
      <div className="mb-4">
        <Select
          value={transactionFilter}
          onValueChange={(value: "all" | "paid" | "pending") => setTransactionFilter(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες</SelectItem>
            <SelectItem value="paid">Πληρωμένες</SelectItem>
            <SelectItem value="pending">Εκκρεμείς</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TransactionList
        transactions={getCustomerTransactions(selectedCustomer?.id || "")}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
        onPayment={handleOpenPaymentDialog}
        getStatusColor={getStatusColor}
      />
    </TabsContent>
  );
  
  const renderCustomerCard = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{selectedCustomer?.name}</CardTitle>
            <CardDescription>Πληροφορίες Πελάτη</CardDescription>
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
              <h3 className="text-sm font-medium">Επικοινωνία</h3>
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
              <h3 className="text-sm font-medium">Διεύθυνση</h3>
              <div className="flex items-center text-sm">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                {selectedCustomer?.address || "Not provided"}
              </div>
            </div>

            {(selectedCustomer?.afm || selectedCustomer?.tractor) && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Περισσότερες πληροφορίες</h3>
                {selectedCustomer?.afm && (
                  <p className="text-sm text-muted-foreground">
                    <strong>ΑΦΜ:</strong> {selectedCustomer.afm}
                  </p>
                )}
                {selectedCustomer?.tractor && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Τρακτέρ:</strong> {selectedCustomer.tractor}
                  </p>
                )}
              </div>
            )}

            {selectedCustomer?.notes && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Σημειώσεις</h3>
                <div className="flex items-start text-sm">
                  <FileText className="h-4 w-4 mr-2 text-muted-foreground mt-0.5" />
                  <span>{selectedCustomer.notes}</span>
                </div>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedCustomer) {
                    handleEdit(selectedCustomer)
                  }
                }}
                className="flex-1"
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (selectedCustomer && confirm("Are you sure you want to delete this employee?")) {
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
  // Filter payments by customer if not "all"
  let filteredPayments: Payment[] = payments;
  if (paymentHistoryCustomerFilter !== "all") {
    filteredPayments = filteredPayments.filter((p: Payment) => p.customerId === paymentHistoryCustomerFilter);
  }
  // Sort payments by date based on sort order:
  filteredPayments.sort((a: Payment, b: Payment) =>
    paymentHistorySortOrder === "desc"
      ? new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      : new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );

  const startPaymentIndex = (currentPaymentPage - 1) * paymentsPerPage;
  const paginatedPayments = filteredPayments.slice(startPaymentIndex, startPaymentIndex + paymentsPerPage);


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
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="text"
                    value={currentCustomer.email}
                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, email: e.target.value })}
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
                  <strong>Προϊόν:</strong> {currentTransaction.productName}
                </p>
                <p>
                  <strong>Συνολικό ποσό:</strong>{" "}
                  €{(Number(currentTransaction.amount) || 0).toLocaleString()}
                </p>
                <p>
                  <strong>Πληρωμένο ποσό:</strong>{" "}
                  €{(Number(currentTransaction.amountPaid) || 0).toLocaleString()}
                </p>
                <p>
                  <strong>Υπόλοιπο:</strong>{" "}
                  €{(Number(currentTransaction.amount) - Number(currentTransaction.amountPaid) || 0).toLocaleString()}
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
                  onChange={(e) =>
                    setPaymentAmount(Number.parseFloat(e.target.value) || 0)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Ημερομηνία Πληρωμής</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Σημειώσεις (προαιρετικά)</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Προσθέστε σημειώσεις για αυτή την πληρωμή (προαιρετικά)"
                  rows={3}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
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
                    className="dark:bg-gray-200 dark:text-gray-900"
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
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Ιστορικό Πληρωμών</h2>
        <div className="flex gap-4 mb-4">
          {/* Customer Filter */}
          <Select
            value={paymentHistoryCustomerFilter}
            onValueChange={(value) => setPaymentHistoryCustomerFilter(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Φιλτράρισμα κατά Πελάτη" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλοι</SelectItem>
              {customers.map((cust) => (
                <SelectItem key={cust.id} value={cust.id}>
                  {cust.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Sort Order Filter */}
          <Select
            value={paymentHistorySortOrder}
            onValueChange={(value) => setPaymentHistorySortOrder(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ταξινόμηση κατά Ημερομηνία" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Νεότερες</SelectItem>
              <SelectItem value="asc">Παλαιότερες</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(() => {
          // Filter payments by customer if not "all"
          let filteredPayments = payments;
          if (paymentHistoryCustomerFilter !== "all") {
            filteredPayments = filteredPayments.filter(
              (p) => p.customerId === paymentHistoryCustomerFilter
            );
          }
          // Sort payments by date
          filteredPayments.sort((a, b) =>
            paymentHistorySortOrder === "desc"
              ? new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
              : new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
          );
          return (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Πελάτης
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Συναλλαγή
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Προϊόν
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ποσό Πληρωμής
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ημ/νία
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Σημειώσεις
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPayments.map((p: Payment) => {
                    const cust = customers.find((c) => c.id === p.customerId);
                    const transactionForPayment = transactions.find((tr) => tr.id === p.transactionId);
                    return (
                      <tr key={p.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                          {cust ? cust.name : "Unknown"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                          {transactionForPayment ? transactionForPayment.productName : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                          {p.productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                          €{p.paymentAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                          {p.paymentDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                          {p.notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-center items-center mt-4 space-x-4">
                <Button
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3"
                  disabled={currentPaymentPage === 1}
                  onClick={() => setCurrentPaymentPage(currentPaymentPage - 1)}
                >
                  ←
                </Button>
                <span className="text-sm font-medium">
                  {currentPaymentPage} / {Math.ceil(filteredPayments.length / paymentsPerPage)}
                </span>
                <Button
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3"
                  disabled={
                    currentPaymentPage === Math.ceil(filteredPayments.length / paymentsPerPage) ||
                    Math.ceil(filteredPayments.length / paymentsPerPage) === 0
                  }
                  onClick={() => setCurrentPaymentPage(currentPaymentPage + 1)}
                >
                  →
                </Button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  )
}
