"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingBag, Mail, Phone, MapPin, FileText } from "lucide-react";
import { translations as t } from "@/lib/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupplierPaymentHistory from "@/components/suppliers/SupplierPaymentHistory";

const STATUS_API = ["pending", "paid", "cancelled"] as const;
type StatusApi = (typeof STATUS_API)[number];

const STATUS_UI: Record<StatusApi, "Σε εκκρεμότητα" | "Πληρώθηκε" | "Ακυρώθηκε"> = {
  pending: "Σε εκκρεμότητα",
  paid: "Πληρώθηκε",
  cancelled: "Ακυρώθηκε",
};

function mapStatusToUi(api: StatusApi): "Σε εκκρεμότητα" | "Πληρώθηκε" | "Ακυρώθηκε" {
  return STATUS_UI[api];
}

function mapStatusToApi(ui: "Σε εκκρεμότητα" | "Πληρώθηκε" | "Ακυρώθηκε"): StatusApi {
  if (ui === "Σε εκκρεμότητα") return "pending";
  if (ui === "Πληρώθηκε") return "paid";
  return "cancelled";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "Πληρώθηκε":
      return "bg-green-100 text-green-800 border-green-200";
    case "Σε εκκρεμότητα":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Ακυρώθηκε":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "";
  }
}

// Supplier interface remains unchanged
interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  totalAmount: number;
  amountPaid: number;
  debt?: number;
}

// New interface for supplier transactions
interface SupplierTransaction {
  id: string;
  supplierId: string;
  productName: string;
  amount: number;
  amountPaid: number;
  date: string;
  status: "Πληρώθηκε" | "Σε εκκρεμότητα" | "Ακυρώθηκε";
  notes: string;
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
};

// Initial supplier transaction – note the supplierId will be set when adding a transaction
const initialSupplierTransaction: SupplierTransaction = {
  id: "",
  supplierId: "",
  productName: "",
  amount: 0,
  amountPaid: 0,
  date: new Date().toISOString().split("T")[0],
  status: "Σε εκκρεμότητα",
  notes: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Supplier>(initialSupplier);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();
  const txAbortRef = useRef<AbortController | null>(null);

  // Transaction-related state for suppliers
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [isSupplierTransactionDialogOpen, setIsSupplierTransactionDialogOpen] = useState(false);
  const [currentSupplierTransaction, setCurrentSupplierTransaction] = useState<SupplierTransaction>(
    initialSupplierTransaction,
  );
  const [isSupplierTransactionEditing, setIsSupplierTransactionEditing] = useState(false);
  const [isSupplierPaymentDialogOpen, setIsSupplierPaymentDialogOpen] = useState(false);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState<string>("");
  const [supplierTransactionFilter, setSupplierTransactionFilter] = useState<
    "all" | "paid" | "pending"
  >("all");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [initialDebt, setInitialDebt] = useState<number>(0);

  // ------------- Supplier Transaction Logic --------------

  const getSupplierTransactions = () => {
    let filtered = supplierTransactions;
    if (supplierTransactionFilter !== "all") {
      filtered = filtered.filter((t) => mapStatusToApi(t.status) === supplierTransactionFilter);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Helper: Compute total paid (or "spent") for a supplier (if needed)
  const getTotalPaid = () =>
    supplierTransactions.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);

  // Helper: Compute outstanding balance ("Χρέη") from pending transactions
  const getDebt = (supplierId?: string) => {
    let list = supplierTransactions;
    if (supplierId) {
      list = list.filter((t) => t.supplierId === supplierId);
    }
    return list
      .filter((t) => mapStatusToApi(t.status) === "pending")
      .reduce((sum, t) => sum + (t.amount - (t.amountPaid || 0)), 0);
  };

  const pendingTxsForSelected = useMemo(
    () =>
      selectedSupplier
        ? supplierTransactions.filter(
            (t) => t.supplierId === selectedSupplier.id && mapStatusToApi(t.status) === "pending",
          )
        : [],
    [selectedSupplier?.id, supplierTransactions],
  );
  const pendingForDialog = pendingTxsForSelected;
  const eur = useMemo(
    () => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }),
    [],
  );
  const selectedDebt = useMemo(
    () => (selectedSupplier ? getDebt(selectedSupplier.id) : 0),
    [selectedSupplier?.id, supplierTransactions],
  );
  const pendingCount = pendingTxsForSelected.length;

  function exportSelectedTransactionsCSV() {
    if (!selectedSupplier) return;

    const rows = supplierTransactions.filter((t) => t.supplierId === selectedSupplier.id);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    const header = ["Date", "Product", "Amount", "Paid", "Status", "Notes"].map(esc).join(",");

    const body = rows
      .map((r) =>
        [r.date, r.productName, r.amount, r.amountPaid, r.status, r.notes].map(esc).join(","),
      )
      .join("\n");

    const csv = `${header}\n${body}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `supplier-${selectedSupplier.name}-transactions.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function fetchSupplierTransactions(supplierId: string) {
    if (!supplierId) return;
    txAbortRef.current?.abort();
    const ac = new AbortController();
    txAbortRef.current = ac;

    const url = `/api/supplier-transactions?supplierId=${encodeURIComponent(supplierId)}`;
    const res = await fetch(url, { credentials: "include", signal: ac.signal });
    if (!res.ok) {
      if (ac.signal.aborted) return;
      console.error("Failed to fetch supplier transactions", await res.text());
      return;
    }
    const data = await res.json();
    const mapped = (data.transactions || []).map((t: any) => ({
      id: t.id,
      supplierId: t.supplier_id,
      productName: t.product_name,
      amount: Number(t.amount) || 0,
      amountPaid: Number(t.amount_paid) || 0,
      date: t.date,
      status: mapStatusToUi(t.status as StatusApi),
      notes: t.notes || "",
    }));
    setSupplierTransactions(mapped);
  }

  // fetch from API and map snake_case -> camelCase
  async function fetchSuppliers() {
    const res = await fetch("/api/suppliers", { credentials: "include" });
    if (!res.ok) {
      console.error("Failed to fetch suppliers", await res.text());
      return;
    }
    const data = await res.json();
    const mapped: Supplier[] = (data.suppliers || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      contactPerson: s.contact_person || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      notes: s.notes || "",
      totalAmount: 0,
      amountPaid: 0,
      debt: Number(s.debt || 0),
    }));
    setSuppliers(mapped);
  }

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const columns = [
    { key: "name", label: "Όνομα" },
    { key: "contactPerson", label: "Υπεύθυνος Επαφής" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Τηλέφωνο" },
    { key: "debt", label: "Οφειλές" },
  ];

  const handleAddNew = () => {
    setCurrentSupplier(initialSupplier);
    setInitialDebt(0);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 404) throw new Error("not-found");
      if (!res.ok) throw new Error("server");

      toast({ title: "Διαγράφηκε", description: "Ο προμηθευτής διαγράφηκε." });
      if (selectedSupplier?.id === id) setSelectedSupplier(null);
      await fetchSuppliers(); // refresh list (and debt totals)
    } catch (e: any) {
      const msg = e?.message === "not-found" ? "Ο προμηθευτής δεν βρέθηκε." : "Κάτι πήγε στραβά.";
      toast({ title: "Σφάλμα", description: msg, variant: "destructive" });
    }
  };

  // Submit for Add/Edit dialog
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = currentSupplier.name?.trim();
    if (!name) {
      toast({
        title: "Σφάλμα",
        description: "Το όνομα είναι υποχρεωτικό.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name,
      contact_person: currentSupplier.contactPerson?.trim() || "",
      email: currentSupplier.email?.trim() || "",
      phone: currentSupplier.phone?.trim() || "",
      address: currentSupplier.address?.trim() || "",
      notes: currentSupplier.notes?.trim() || "",
    };

    try {
      if (isEditing) {
        const res = await fetch(`/api/suppliers/${currentSupplier.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.status === 404) throw new Error("not-found");
        if (res.status === 409) throw new Error("conflict");
        if (!res.ok) throw new Error("server");

        toast({ title: "Ενημερώθηκε", description: "Ο προμηθευτής ενημερώθηκε." });
      } else {
        const res = await fetch(`/api/suppliers`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.status === 409) throw new Error("conflict");
        if (!res.ok) throw new Error("server");

        // Parse the created supplier so we have its id
        const created = await res.json();
        const createdId = created?.supplier?.id;

        // If user provided an initial balance, create an opening transaction
        if (createdId && initialDebt > 0) {
          const txPayload = {
            supplier_id: createdId,
            product_name: "Υπόλοιπο Έναρξης",
            amount: Number(initialDebt),
            amount_paid: 0,
            date: new Date().toISOString().slice(0, 10),
            status: "pending",
            notes: "Αρχικό υπόλοιπο",
          };

          const txRes = await fetch(`/api/supplier-transactions`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify(txPayload),
          });

          if (txRes.ok) {
            const txJson = await txRes.json();
            const txId = txJson?.transaction?.id;
            if (txId) {
              // also log to payments history as a "debt"
              await fetch(`/api/supplier-payments`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  supplier_id: createdId,
                  transaction_id: txId,
                  amount: Number(initialDebt),
                  date: txPayload.date,
                  notes: `Δημιουργία οφειλής "${txPayload.product_name}"`,
                  type: "debt",
                }),
              });
            }
          } else {
            console.error("Failed to create opening balance:", await txRes.text());
          }
        }
      }

      setIsDialogOpen(false);
      await fetchSuppliers(); // refresh list + debt
    } catch (e: any) {
      const msg =
        e?.message === "conflict"
          ? "Υπάρχει ήδη προμηθευτής με αυτό το όνομα."
          : e?.message === "not-found"
            ? "Ο προμηθευτής δεν βρέθηκε."
            : "Κάτι πήγε στραβά.";
      toast({ title: "Σφάλμα", description: msg, variant: "destructive" });
    }
  };

  const handleRowClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
  };

  useEffect(() => {
    if (selectedSupplier?.id) {
      fetchSupplierTransactions(selectedSupplier.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSupplier?.id]);

  // We'll augment supplier data with debt for display in DataTable if needed
  const suppliersWithDebt = suppliers; // debt already provided by API

  // Open the Add Transaction dialog for the selected supplier
  const handleAddSupplierTransaction = () => {
    if (!selectedSupplier) return;
    setCurrentSupplierTransaction({
      ...initialSupplierTransaction,
      supplierId: selectedSupplier.id,
    });
    setIsSupplierTransactionEditing(false);
    setIsSupplierTransactionDialogOpen(true);
  };

  // Open the Edit Transaction dialog for a specific transaction
  const handleEditSupplierTransaction = (transaction: SupplierTransaction) => {
    setCurrentSupplierTransaction(transaction);
    setIsSupplierTransactionEditing(true);
    setIsSupplierTransactionDialogOpen(true);
  };

  function handleOpenPaymentForSelected() {
    if (!selectedSupplier) return;

    // Pick the most recent pending debt for the supplier (or block if none)
    const pending = pendingTxsForSelected
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (pending.length === 0) {
      toast({
        title: "Δεν υπάρχουν εκκρεμείς οφειλές",
        description: "Ο προμηθευτής δεν έχει ανοιχτές οφειλές.",
      });
      return;
    }

    setCurrentSupplierTransaction(pending[0]);
    setSupplierPaymentAmount("");
    setIsSupplierPaymentDialogOpen(true);
  }

  // Submission handler for supplier transactions
  const handleSupplierTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tx = currentSupplierTransaction;
    if (!tx.productName?.trim() || !tx.amount) {
      toast({
        title: "Σφάλμα",
        description: "Το όνομα του προϊόντος και το ποσό είναι υποχρεωτικά πεδία.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedSupplier?.id) {
      toast({
        title: "Σφάλμα",
        description: "Δεν έχει επιλεχθεί προμηθευτής.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      supplier_id: selectedSupplier.id,
      product_name: tx.productName.trim(),
      amount: Number(tx.amount),
      amount_paid: Number(tx.amountPaid) || 0,
      date: tx.date || new Date().toISOString().slice(0, 10),
      status: mapStatusToApi(tx.status), // server will auto-set to 'paid' if amount_paid >= amount
      notes: tx.notes || "",
    };

    try {
      if (isSupplierTransactionEditing) {
        const res = await fetch(`/api/supplier-transactions/${tx.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        toast({
          title: "Η συναλλαγή ενημερώθηκε",
          description: "Η συναλλαγή ενημερώθηκε επιτυχώς.",
        });
      } else {
        const res = await fetch(`/api/supplier-transactions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        const txId = created?.transaction?.id;

        // Record "new debt" in payments history so it appears in the list
        if (txId) {
          try {
            await fetch(`/api/supplier-payments`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                supplier_id: selectedSupplier.id,
                transaction_id: txId,
                amount: Number(payload.amount),
                date: payload.date,
                notes: `Δημιουργία οφειλής "${payload.product_name}"`,
                type: "debt",
              }),
            });
          } catch (e) {
            console.warn("Debt history log failed:", e);
          }
        }
        toast({
          title: "Η συναλλαγή προστέθηκε",
          description: "Η συναλλαγή καταχωρήθηκε επιτυχώς.",
        });
        setHistoryRefresh((k) => k + 1);
      }

      setIsSupplierTransactionDialogOpen(false);
      setIsSupplierTransactionEditing(false);
      await fetchSupplierTransactions(selectedSupplier.id); // refresh list
      await fetchSuppliers(); // refresh debt in suppliers table
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία αποθήκευσης συναλλαγής.",
        variant: "destructive",
      });
    }
  };

  const currentDebt = useMemo(
    () => suppliers.find((s) => s.id === currentSupplier.id)?.debt ?? 0,
    [suppliers, currentSupplier.id],
  );

  const handleSupplierPaymentSubmit = async () => {
    const tx = currentSupplierTransaction;
    if (!selectedSupplier?.id) return;

    const remaining = Number(tx.amount) - Number(tx.amountPaid);
    const amountNum = parseFloat(supplierPaymentAmount.replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({
        title: "Σφάλμα",
        description: "Το ποσό πληρωμής πρέπει να είναι μεγαλύτερο από το μηδέν.",
        variant: "destructive",
      });
      return;
    }
    if (amountNum > remaining) {
      toast({
        title: "Σφάλμα",
        description: "Το ποσό πληρωμής δεν μπορεί να υπερβαίνει το υπόλοιπο.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/supplier-payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplier_id: selectedSupplier.id,
          transaction_id: tx.id,
          amount: amountNum,
          date: new Date().toISOString().slice(0, 10),
          notes: `Πληρωμή για "${tx.productName}"`,
          type: "payment",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Payment failed");

      toast({ title: "Επιτυχής Πληρωμή", description: "Η πληρωμή καταχωρήθηκε." });
      setIsSupplierPaymentDialogOpen(false);
      setSupplierPaymentAmount("");

      await fetchSupplierTransactions(selectedSupplier.id); // will reflect new amount_paid
      await fetchSuppliers(); // supplier debt may change
      setHistoryRefresh((k) => k + 1); // refresh history list
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Σφάλμα",
        description: err?.message || "Αποτυχία πληρωμής.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSupplierTransaction = async (transactionId: string) => {
    if (!selectedSupplier?.id) return;
    if (!confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτήν τη συναλλαγή;")) return;

    try {
      const res = await fetch(`/api/supplier-transactions/${transactionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Η συναλλαγή διαγράφηκε", description: "Η συναλλαγή διαγράφηκε επιτυχώς." });

      await fetchSupplierTransactions(selectedSupplier.id);
      await fetchSuppliers(); // debt changes
    } catch (err: any) {
      console.error(err);
      toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής.", variant: "destructive" });
    }
  };

  // Render supplier details with a tab for transactions
  const renderSupplierCard = (supplier: Supplier) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{selectedSupplier?.name}</CardTitle>
            <CardDescription>Στοιχεία Προμηθευτή</CardDescription>
          </div>
          <Badge variant="outline" className="ml-2">
            <ShoppingBag className="mr-1 h-3 w-3" />
            Προμηθευτής
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1 justify-center">
              Λεπτομέρειες
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Πληροφορίες Επικοινωνίας</h3>
              <div className="grid gap-2">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  {selectedSupplier?.email}
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                  {selectedSupplier?.phone || "Δεν έχει δοθεί"}
                </div>
              </div>
              <div className="space-y-2 pt-4">
                <h3 className="text-sm font-medium">Διεύθυνση</h3>
                <div className="flex items-start text-sm">
                  <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{selectedSupplier?.address || "Δεν έχει δοθεί"}</span>
                </div>
              </div>
              {selectedSupplier?.notes && (
                <div className="space-y-2 pt-4">
                  <h3 className="text-sm font-medium">Σημειώσεις</h3>
                  <div className="flex items-start text-sm">
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{selectedSupplier.notes}</span>
                  </div>
                </div>
              )}
              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedSupplier && handleEdit(selectedSupplier)}
                  className="flex-1"
                >
                  Επεξεργασία
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον προμηθευτή;")) {
                      handleDelete(selectedSupplier!.id);
                    }
                  }}
                  className="flex-1"
                >
                  Διαγραφή
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.suppliersTitle}</h1>
        <p className="text-muted-foreground">{t.manageSupplierVendors}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
            renderSupplierCard(selectedSupplier)
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

      {/* Actions between suppliers table and transactions history */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm text-muted-foreground">
          {selectedSupplier ? (
            <>
              Ενέργειες για:{" "}
              <span className="font-medium text-foreground">{selectedSupplier.name}</span>
            </>
          ) : (
            "Επιλέξτε προμηθευτή για ενέργειες"
          )}
        </div>
        {selectedSupplier && (
          <div className="text-sm text-muted-foreground">
            Εκκρεμείς συναλλαγές: <span className="font-medium">{pendingCount}</span> • Υπόλοιπο:{" "}
            <span className="font-medium text-foreground">{eur.format(selectedDebt)}</span>
          </div>
        )}
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddSupplierTransaction}
            disabled={!selectedSupplier}
            className="w-full sm:w-auto"
          >
            Προσθήκη Οφειλής
          </Button>
          <Button
            size="sm"
            onClick={handleOpenPaymentForSelected}
            disabled={!selectedSupplier || pendingTxsForSelected.length === 0}
            className="w-full sm:w-auto"
          >
            Πληρωμή
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportSelectedTransactionsCSV}
            disabled={!selectedSupplier}
          >
            Εξαγωγή CSV
          </Button>
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
                    onChange={(e) =>
                      setCurrentSupplier({ ...currentSupplier, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">{t.contactPerson}</Label>
                  <Input
                    id="contactPerson"
                    value={currentSupplier.contactPerson}
                    onChange={(e) =>
                      setCurrentSupplier({ ...currentSupplier, contactPerson: e.target.value })
                    }
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
                    onChange={(e) =>
                      setCurrentSupplier({ ...currentSupplier, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input
                    id="phone"
                    value={currentSupplier.phone}
                    onChange={(e) =>
                      setCurrentSupplier({ ...currentSupplier, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t.address}</Label>
                <Input
                  id="address"
                  value={currentSupplier.address}
                  onChange={(e) =>
                    setCurrentSupplier({ ...currentSupplier, address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={currentSupplier.notes}
                  onChange={(e) =>
                    setCurrentSupplier({ ...currentSupplier, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="initialDebt">Αρχικό Υπόλοιπο (προαιρετικό)</Label>
                  <Input
                    id="initialDebt"
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialDebt}
                    onChange={(e) => setInitialDebt(parseFloat(e.target.value || "0"))}
                  />
                </div>
              )}
              {/* Read-only computed debt, correlating with supplier transactions */}
              <div className="space-y-2">
                <Label>Οφειλές</Label>
                <Input value={currentSupplier.id ? currentDebt.toFixed(2) : "0.00"} readOnly />
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSupplierPaymentSubmit();
            }}
          >
            <div className="grid gap-4 py-4">
              {pendingTxsForSelected.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="chooseTx">Επιλέξτε Οφειλή</Label>
                  <Select
                    value={currentSupplierTransaction?.id || ""}
                    onValueChange={(id) => {
                      const tx = pendingTxsForSelected.find((x) => x.id === id);
                      if (tx) {
                        setCurrentSupplierTransaction(tx);
                        setSupplierPaymentAmount("");
                      }
                    }}
                  >
                    <SelectTrigger id="chooseTx">
                      <SelectValue placeholder="Επιλέξτε οφειλή" />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingTxsForSelected.map((tx) => {
                        const remaining = (Number(tx.amount) || 0) - (Number(tx.amountPaid) || 0);
                        return (
                          <SelectItem key={tx.id} value={tx.id}>
                            {tx.productName} — Υπόλοιπο €{remaining.toLocaleString()}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <p>
                  <strong>Προϊόν:</strong> {currentSupplierTransaction.productName}
                </p>
                <p>
                  <strong>Σύνολο:</strong> €
                  {(Number(currentSupplierTransaction.amount) || 0).toLocaleString()}
                </p>
                <p>
                  <strong>Εξοφλημένο:</strong> €
                  {(Number(currentSupplierTransaction.amountPaid) || 0).toLocaleString()}
                </p>
                <p>
                  <strong>Υπόλοιπο:</strong> €
                  {(
                    Number(currentSupplierTransaction.amount) -
                      Number(currentSupplierTransaction.amountPaid) || 0
                  ).toLocaleString()}
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
                  onChange={(e) => setSupplierPaymentAmount(e.target.value)}
                  placeholder={`Μέχρι €${(
                    (Number(currentSupplierTransaction.amount) || 0) -
                    (Number(currentSupplierTransaction.amountPaid) || 0)
                  ).toLocaleString()}`}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSupplierPaymentDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit">Πληρωμή</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Transaction Dialog */}
      <Dialog
        open={isSupplierTransactionDialogOpen}
        onOpenChange={setIsSupplierTransactionDialogOpen}
      >
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
                  onChange={(e) =>
                    setCurrentSupplierTransaction({
                      ...currentSupplierTransaction,
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
                    value={currentSupplierTransaction.amount}
                    onChange={(e) =>
                      setCurrentSupplierTransaction({
                        ...currentSupplierTransaction,
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
                    className="dark:bg-gray-200 dark:text-gray-900"
                    value={currentSupplierTransaction.date}
                    onChange={(e) =>
                      setCurrentSupplierTransaction({
                        ...currentSupplierTransaction,
                        date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t.status}</Label>
                <Select
                  value={mapStatusToApi(currentSupplierTransaction.status)}
                  onValueChange={(value: "paid" | "pending" | "cancelled") =>
                    setCurrentSupplierTransaction({
                      ...currentSupplierTransaction,
                      status: mapStatusToUi(value as StatusApi),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε κατάσταση" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Πληρώθηκε</SelectItem>
                    <SelectItem value="pending">Σε εκκρεμότητα</SelectItem>
                    <SelectItem value="cancelled">Ακυρώθηκε</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={currentSupplierTransaction.notes}
                  onChange={(e) =>
                    setCurrentSupplierTransaction({
                      ...currentSupplierTransaction,
                      notes: e.target.value,
                    })
                  }
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSupplierTransactionDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit">
                {isSupplierTransactionEditing ? "Αποθήκευση" : t.addTransaction}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SupplierPaymentHistory
        supplierId={selectedSupplier?.id || undefined}
        refreshKey={historyRefresh}
        pageSize={10}
      />
    </div>
  );
}
