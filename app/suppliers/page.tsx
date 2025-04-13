"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { generateId, getLocalData, setLocalData } from "@/lib/utils"
import { TransactionList } from "@/components/TransactionList"
import { initializeData } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ShoppingBag, Mail, Phone, MapPin, FileText } from "lucide-react"
import { translations as t } from "@/lib/translations"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Supplier interface remains unchanged
interface Supplier {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  notes: string
  totalAmount: number
  amountPaid: number
}

// New interface for supplier transactions
interface SupplierTransaction {
  id: string
  supplierId: string
  productName: string
  amount: number
  amountPaid: number
  date: string
  status: "paid" | "pending" | "cancelled"
  notes: string
}

const initialSupplier: Supplier = {
  id: "",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  totalAmount: 0,
  amountPaid: 0,
}

// Initial supplier transaction – note the supplierId will be set when adding a transaction
const initialSupplierTransaction: SupplierTransaction = {
  id: "",
  supplierId: "",
  productName: "",
  amount: 0,
  amountPaid: 0,
  date: new Date().toISOString().split("T")[0],
  status: "pending",
  notes: "",
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentSupplier, setCurrentSupplier] = useState<Supplier>(initialSupplier)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const { toast } = useToast()

  // Transaction-related state for suppliers
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([])
  const [isSupplierTransactionDialogOpen, setIsSupplierTransactionDialogOpen] = useState(false)
  const [currentSupplierTransaction, setCurrentSupplierTransaction] = useState<SupplierTransaction>(initialSupplierTransaction)
  const [isSupplierTransactionEditing, setIsSupplierTransactionEditing] = useState(false)
  const [isSupplierPaymentDialogOpen, setIsSupplierPaymentDialogOpen] = useState(false)
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState<number>(0)
  const [supplierTransactionFilter, setSupplierTransactionFilter] = useState<"all" | "paid" | "pending">("all");

  useEffect(() => {
    // Initialize sample data if needed
    if (typeof window !== "undefined") {
      initializeData()
    }
    const supplierData = getLocalData("suppliers") || []
    setSuppliers(supplierData)
    const transactionsData = getLocalData("supplierTransactions") || []
    setSupplierTransactions(transactionsData)
  }, [])

  const columns = [
    { key: "name", label: "Όνομα" },
    { key: "contactPerson", label: "Υπεύθυνος Επαφής" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Τηλέφωνο" },
    { key: "debt", label: "Οφειλές" },
  ]

  const handleAddNew = () => {
    setCurrentSupplier(initialSupplier)
    setIsEditing(false)
    setIsDialogOpen(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setCurrentSupplier(supplier)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const updatedSuppliers = suppliers.filter((supplier) => supplier.id !== id)
    setSuppliers(updatedSuppliers)
    setLocalData("suppliers", updatedSuppliers)
    if (selectedSupplier && selectedSupplier.id === id) {
      setSelectedSupplier(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSupplier.name) {
      toast({
        title: "Σφάλμα",
        description: "Το όνομα και το email είναι υποχρεωτικά πεδία.",
        variant: "destructive",
      })
      return
    }
    let updatedSuppliers: Supplier[]
    if (isEditing) {
      updatedSuppliers = suppliers.map((supplier) =>
        supplier.id === currentSupplier.id ? currentSupplier : supplier
      )
      toast({
        title: t.supplierUpdated,
        description: "Ο προμηθευτής ενημερώθηκε με επιτυχία.",
      })
      if (selectedSupplier && selectedSupplier.id === currentSupplier.id) {
        setSelectedSupplier(currentSupplier)
      }
    } else {
      const newSupplier = { ...currentSupplier, id: generateId() }
      updatedSuppliers = [...suppliers, newSupplier]
      toast({
        title: t.supplierAdded,
        description: "Ο προμηθευτής προστέθηκε με επιτυχία.",
      })
    }
    setSuppliers(updatedSuppliers)
    setLocalData("suppliers", updatedSuppliers)
    setIsDialogOpen(false)
  }

  const handleRowClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
  }

  // ------------- Supplier Transaction Logic --------------

  const getSupplierTransactions = (supplierId: string) => {
    let filtered = supplierTransactions.filter((t) => t.supplierId === supplierId);
    if (supplierTransactionFilter !== "all") {
      filtered = filtered.filter((t) => t.status === supplierTransactionFilter);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };  
  

  // Helper: Compute total paid (or "spent") for a supplier (if needed)
  const getTotalPaid = (supplierId: string) => {
    return supplierTransactions
      .filter((t) => t.supplierId === supplierId)
      .reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
  }  

  // Helper: Compute outstanding balance ("Χρέη") from pending transactions
  const getDebt = (supplierId: string) => {
    return supplierTransactions
      .filter((t) => t.supplierId === supplierId && t.status === "pending")
      .reduce((sum, t) => sum + (t.amount - (t.amountPaid || 0)), 0)
  }

  // We'll augment supplier data with debt for display in DataTable if needed
  const suppliersWithDebt = suppliers.map((supplier) => ({
    ...supplier,
    debt: getDebt(supplier.id),
  }))

  // Open the Add Transaction dialog for the selected supplier
  const handleAddSupplierTransaction = () => {
    if (!selectedSupplier) return
    setCurrentSupplierTransaction({
      ...initialSupplierTransaction,
      supplierId: selectedSupplier.id,
    })
    setIsSupplierTransactionEditing(false)
    setIsSupplierTransactionDialogOpen(true)
  }

  // Open the Edit Transaction dialog for a specific transaction
  const handleEditSupplierTransaction = (transaction: SupplierTransaction) => {
    setCurrentSupplierTransaction(transaction)
    setIsSupplierTransactionEditing(true)
    setIsSupplierTransactionDialogOpen(true)
  }

  // Submission handler for supplier transactions
  const handleSupplierTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSupplierTransaction.productName || !currentSupplierTransaction.amount) {
      toast({
        title: "Σφάλμα",
        description: "Το όνομα του προϊόντος και το ποσό είναι υποχρεωτικά πεδία.",
        variant: "destructive",
      })
      return
    }
    // Create a copy and update status if fully paid
    const transactionToSave = { ...currentSupplierTransaction }
    if (transactionToSave.amountPaid >= transactionToSave.amount) {
      transactionToSave.status = "paid"
    }
    if (isSupplierTransactionEditing) {
      const updatedTransactions = supplierTransactions.map((t) =>
        t.id === transactionToSave.id ? transactionToSave : t
      )
      setSupplierTransactions(updatedTransactions)
      setLocalData("supplierTransactions", updatedTransactions)
      toast({
        title: "Η συναλλαγή ενημερώθηκε",
        description: "Η συναλλαγή ενημερώθηκε επιτυχώς.",
      })
      setIsSupplierTransactionEditing(false)
    } else {
      transactionToSave.id = generateId()
      const updatedTransactions = [...supplierTransactions, transactionToSave]
      setSupplierTransactions(updatedTransactions)
      setLocalData("supplierTransactions", updatedTransactions)
      toast({
        title: "Η συναλλαγή προστέθηκε",
        description: "Η συναλλαγή καταχωρήθηκε επιτυχώς.",
      })
    }
    setIsSupplierTransactionDialogOpen(false)
  }

  // Payment handling for a supplier transaction
  const handleOpenSupplierPaymentDialog = (transaction: SupplierTransaction) => {
    setCurrentSupplierTransaction(transaction)
    setSupplierPaymentAmount(0)
    setIsSupplierPaymentDialogOpen(true)
  }

  const handleSupplierPaymentSubmit = () => {
    const remaining =
      Number(currentSupplierTransaction.amount) - Number(currentSupplierTransaction.amountPaid)
    if (supplierPaymentAmount <= 0) {
      toast({
        title: "Σφάλμα",
        description: "Το ποσό πληρωμής πρέπει να είναι μεγαλύτερο από το μηδέν.",
        variant: "destructive",
      })
      return
    }
    if (supplierPaymentAmount > remaining) {
      toast({
        title: "Σφάλμα",
        description: "Το ποσό πληρωμής δεν μπορεί να υπερβαίνει το υπόλοιπο.",
        variant: "destructive",
      })
      return
    }
    const updatedTransaction = { ...currentSupplierTransaction }
    updatedTransaction.amountPaid += supplierPaymentAmount
    if (updatedTransaction.amountPaid >= updatedTransaction.amount) {
      updatedTransaction.status = "paid"
    }
    const updatedTransactions = supplierTransactions.map((t) =>
      t.id === updatedTransaction.id ? updatedTransaction : t
    )
    setSupplierTransactions(updatedTransactions)
    setLocalData("supplierTransactions", updatedTransactions)
    toast({
      title: "Επιτυχής Πληρωμή",
      description: "Η πληρωμή καταχωρήθηκε.",
    })
    setIsSupplierPaymentDialogOpen(false)
    setSupplierPaymentAmount(0)
  }

  const handleDeleteSupplierTransaction = (transactionId: string) => {
    if (confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτήν τη συναλλαγή;")) {
      const updatedTransactions = supplierTransactions.filter((t) => t.id !== transactionId)
      setSupplierTransactions(updatedTransactions)
      setLocalData("supplierTransactions", updatedTransactions)
      toast({
        title: "Η συναλλαγή διαγράφηκε",
        description: "Η συναλλαγή διαγράφηκε επιτυχώς.",
      })
    }
  }

  // ------------- UI Rendering --------------

  // Render the supplier transactions tab inside the supplier details card
  const renderSupplierTransactionsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium">Ιστορικό Συναλλαγών</h3>
          <p className="text-sm text-muted-foreground">
            {t.totalSpent}: ${getTotalPaid(selectedSupplier?.id || "").toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={supplierTransactionFilter}
            onValueChange={(value) =>
              setSupplierTransactionFilter(value as "all" | "paid" | "pending")
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Φίλτρο" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλα</SelectItem>
              <SelectItem value="paid">Εξοφλημένα</SelectItem>
              <SelectItem value="pending">Εκκρεμή</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAddSupplierTransaction} size="sm">
            {t.addTransaction}
          </Button>
        </div>
      </div>
      <TransactionList
        transactions={getSupplierTransactions(selectedSupplier?.id || "")}
        onEdit={handleEditSupplierTransaction}
        onDelete={handleDeleteSupplierTransaction}
        onPayment={handleOpenSupplierPaymentDialog}
      />
    </div>
  );  

  // Render supplier details with a tab for transactions
  const renderSupplierCard = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{selectedSupplier?.name}</CardTitle>
            <CardDescription>Στοιχεία Προμηθευτή</CardDescription>
          </div>
          <Badge variant="outline" className="ml-2">
            <ShoppingBag className="h-3 w-3 mr-1" />
            Προμηθευτής
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Λεπτομέρειες</TabsTrigger>
            <TabsTrigger value="transactions">Συναλλαγές</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Πληροφορίες Επικοινωνίας</h3>
              <div className="grid gap-2">
                <div className="flex items-center text-sm">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  {selectedSupplier?.email}
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  {selectedSupplier?.phone || "Δεν έχει δοθεί"}
                </div>
              </div>
              <div className="space-y-2 pt-4">
                <h3 className="text-sm font-medium">Διεύθυνση</h3>
                <div className="flex items-start text-sm">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{selectedSupplier?.address || "Δεν έχει δοθεί"}</span>
                </div>
              </div>
              {selectedSupplier?.notes && (
                <div className="space-y-2 pt-4">
                  <h3 className="text-sm font-medium">Σημειώσεις</h3>
                  <div className="flex items-start text-sm">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{selectedSupplier.notes}</span>
                  </div>
                </div>
              )}
              <div className="pt-4 flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(selectedSupplier)} className="flex-1">
                  Επεξεργασία
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον προμηθευτή;")) {
                      handleDelete(selectedSupplier?.id || '')
                    }
                  }}
                  className="flex-1"
                >
                  Διαγραφή
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="transactions">
            {renderSupplierTransactionsTab()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )  

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.suppliersTitle}</h1>
        <p className="text-muted-foreground">{t.manageSupplierVendors}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={suppliersWithDebt}
            onAdd={handleAddNew}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSelect={(supplier: Supplier) => setSelectedSupplier(supplier)}
          />
        </div>
        <div>
          {selectedSupplier ? (
            renderSupplierCard()
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t.noSupplierSelected}</CardTitle>
                <CardDescription>{t.selectSupplier}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.selectSupplierDetails}</p>
                <Button onClick={handleAddNew} className="mt-4 w-full">
                  {t.addNewSupplier}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Supplier Dialog for adding/editing supplier */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? t.editSupplier : t.addNewSupplier}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.supplierName} *</Label>
                  <Input
                    id="name"
                    value={currentSupplier.name}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">{t.contactPerson}</Label>
                  <Input
                    id="contactPerson"
                    value={currentSupplier.contactPerson}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, contactPerson: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="text"
                    value={currentSupplier.email}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input
                    id="phone"
                    value={currentSupplier.phone}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t.address}</Label>
                <Input
                  id="address"
                  value={currentSupplier.address}
                  onChange={(e) => setCurrentSupplier({ ...currentSupplier, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={currentSupplier.notes}
                  onChange={(e) => setCurrentSupplier({ ...currentSupplier, notes: e.target.value })}
                  rows={3}
                />
              </div>
              {/* Read-only computed debt, correlating with supplier transactions */}
              <div className="space-y-2">
                <Label>Οφειλές</Label>
                <Input
                  value={currentSupplier.id ? getDebt(currentSupplier.id).toFixed(2) : "0.00"}
                  readOnly
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{isEditing ? t.update : t.add}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Payment Dialog */}
      <Dialog open={isSupplierPaymentDialogOpen} onOpenChange={setIsSupplierPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Πληρωμή Συναλλαγής</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSupplierPaymentSubmit(); }}>
            <div className="grid gap-4 py-4">
              <div>
                <p>
                  <strong>Προϊόν:</strong> {currentSupplierTransaction.productName}
                </p>
                <p>
                  <strong>Σύνολο:</strong> €{ (Number(currentSupplierTransaction.amount) || 0).toLocaleString() }
                </p>
                <p>
                  <strong>Εξοφλημένο:</strong> €{ (Number(currentSupplierTransaction.amountPaid) || 0).toLocaleString() }
                </p>
                <p>
                  <strong>Υπόλοιπο:</strong> €{ (Number(currentSupplierTransaction.amount) - Number(currentSupplierTransaction.amountPaid) || 0).toLocaleString() }
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierPaymentAmount">Ποσό Πληρωμής</Label>
                <Input
                  id="supplierPaymentAmount"
                  type="number"
                  min="0"
                  max={currentSupplierTransaction.amount - currentSupplierTransaction.amountPaid}
                  step="0.01"
                  value={supplierPaymentAmount}
                  onChange={(e) => setSupplierPaymentAmount(Number.parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSupplierPaymentDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">Πληρωμή</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Transaction Dialog */}
      <Dialog open={isSupplierTransactionDialogOpen} onOpenChange={setIsSupplierTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isSupplierTransactionEditing ? "Αποθήκευση Συναλλαγής" : t.addTransaction}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSupplierTransactionSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">{t.productName} *</Label>
                <Input
                  id="productName"
                  value={currentSupplierTransaction.productName}
                  onChange={(e) => setCurrentSupplierTransaction({ ...currentSupplierTransaction, productName: e.target.value })}
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
                    value={currentSupplierTransaction.amount}
                    onChange={(e) =>
                      setCurrentSupplierTransaction({
                        ...currentSupplierTransaction,
                        amount: Number.parseFloat(e.target.value)
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
                    className=" dark:bg-gray-200 dark:text-gray-900"
                    value={currentSupplierTransaction.date}
                    onChange={(e) =>
                      setCurrentSupplierTransaction({
                        ...currentSupplierTransaction,
                        date: e.target.value
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t.status}</Label>
                <Select
                  value={currentSupplierTransaction.status}
                  onValueChange={(value: "paid" | "pending" | "cancelled") =>
                    setCurrentSupplierTransaction({ ...currentSupplierTransaction, status: value })
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
                  value={currentSupplierTransaction.notes}
                  onChange={(e) => setCurrentSupplierTransaction({ ...currentSupplierTransaction, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            {/* Input for Amount Paid */}
            <div className="space-y-2">
              <Label htmlFor="amountPaid">Εξοφλημένο Ποσό</Label>
              <Input
                id="amountPaid"
                type="number"
                min="0"
                step="0.01"
                value={currentSupplierTransaction.amountPaid}
                onChange={(e) =>
                  setCurrentSupplierTransaction({
                    ...currentSupplierTransaction,
                    amountPaid: Number.parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSupplierTransactionDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{isSupplierTransactionEditing ? "Αποθήκευση" : t.addTransaction}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
