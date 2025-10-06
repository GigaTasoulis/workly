"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Building2, FileText, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { translations as t } from "@/lib/translations";
import CustomerPaymentHistory from "@/components/customers/CustomerPaymentHistory";
import SimplePager from "@/components/pagination/SimplePager";
/* ---------------- Status helpers (UI <-> API) ---------------- */

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

/* ---------------- Types ---------------- */

interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  afm: string;
  tractor: string;
  notes: string;
  debt?: number;
}

interface CustomerTransaction {
  id: string;
  customerId: string;
  productName: string;
  amount: number;
  amountPaid: number;
  date: string; // YYYY-MM-DD
  status: "Πληρώθηκε" | "Σε εκκρεμότητα" | "Ακυρώθηκε";
  notes: string;
}

/* ---------------- Mapping helpers ---------------- */

function uiCustomerToApi(c: Partial<Customer>) {
  return {
    name: c.name?.trim(),
    contact_person: c.contactPerson?.trim(),
    email: c.email?.trim(),
    phone: c.phone?.trim(),
    address: c.address?.trim(),
    afm: c.afm?.trim(),
    tractor: c.tractor?.trim(),
    notes: c.notes?.trim(),
  };
}
function apiRowToCustomer(r: any): Customer {
  return {
    id: r.id,
    name: r.name || "",
    contactPerson: r.contact_person || "",
    email: r.email || "",
    phone: r.phone || "",
    address: r.address || "",
    afm: r.afm || "",
    tractor: r.tractor || "",
    notes: r.notes || "",
    debt: Number(r.debt || 0),
  };
}

/* ---------------- API helpers ---------------- */

async function fetchCustomersApi(): Promise<Customer[]> {
  const r = await fetch(`/api/customers`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  const list: any[] = data.customers || [];
  return list.map(apiRowToCustomer);
}

async function fetchCustomerTransactions(
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerTransaction[]> {
  const url = `/api/customer-transactions?customer_id=${encodeURIComponent(customerId)}`;
  const r = await fetch(url, { credentials: "include", signal });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  const mapped: CustomerTransaction[] = (data.transactions || []).map((t: any) => ({
    id: t.id,
    customerId: t.customer_id,
    productName: t.product_name,
    amount: Number(t.amount) || 0,
    amountPaid: Number(t.amount_paid) || 0,
    date: t.date,
    status: mapStatusToUi(t.status as StatusApi),
    notes: t.notes || "",
  }));
  return mapped;
}

async function createCustomerApi(input: Partial<Customer>): Promise<string> {
  const r = await fetch(`/api/customers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(uiCustomerToApi(input)),
  });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return data?.customer?.id as string;
}

async function updateCustomerApi(id: string, input: Partial<Customer>): Promise<void> {
  const r = await fetch(`/api/customers/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(uiCustomerToApi(input)),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function deleteCustomerApi(id: string): Promise<void> {
  const r = await fetch(`/api/customers/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
}

async function createCustomerTransactionApi(tx: {
  customerId: string;
  productName: string;
  amount: number;
  amountPaid: number;
  date: string;
  status: "paid" | "pending" | "cancelled";
  notes: string;
}): Promise<string> {
  const r = await fetch(`/api/customer-transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      customer_id: tx.customerId,
      product_name: tx.productName,
      amount: tx.amount,
      amount_paid: tx.amountPaid,
      date: tx.date,
      status: tx.status,
      notes: tx.notes,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Failed to create transaction");
  return String(j?.transaction?.id);
}

async function updateCustomerTransactionApi(
  id: string,
  tx: Partial<CustomerTransaction>,
): Promise<void> {
  const r = await fetch(`/api/customer-transactions/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      customer_id: tx.customerId,
      product_name: tx.productName,
      amount: tx.amount,
      amount_paid: tx.amountPaid,
      date: tx.date,
      status: tx.status ? mapStatusToApi(tx.status) : undefined,
      notes: tx.notes,
    }),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function deleteCustomerTransactionApi(id: string): Promise<void> {
  const r = await fetch(`/api/customer-transactions/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!r.ok) throw new Error(await r.text());
}

async function createCustomerPaymentApi(input: {
  transactionId: string;
  amount: number;
  date?: string;
  notes?: string;
}) {
  const r = await fetch(`/api/customer-payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      transaction_id: input.transactionId,
      amount: input.amount,
      date: input.date,
      notes: input.notes,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Payment failed");
  return j;
}

/* ---------------- Component ---------------- */

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
};

const emptyTx: CustomerTransaction = {
  id: "",
  customerId: "",
  productName: "",
  amount: 0,
  amountPaid: 0,
  date: new Date().toISOString().slice(0, 10),
  status: "Σε εκκρεμότητα",
  notes: "",
};

export default function CustomersPage() {
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((customers?.length ?? 0) / pageSize)),
    [customers?.length],
  );
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [pageSafe]);

  const pagedCustomers = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return customers.slice(start, start + pageSize);
  }, [customers, pageSafe]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const txAbortRef = useRef<AbortController | null>(null);

  // dialogs
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // forms
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(initialCustomer);
  const [initialDebt, setInitialDebt] = useState<number>(0);

  const [isEditingTx, setIsEditingTx] = useState(false);
  const [currentTx, setCurrentTx] = useState<CustomerTransaction>(emptyTx);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const [txFilter, setTxFilter] = useState<"all" | "paid" | "pending">("all");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const eur = useMemo(
    () => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }),
    [],
  );
  const pendingTxsForSelected = useMemo(
    () =>
      selectedCustomer
        ? transactions.filter(
            (t) => t.customerId === selectedCustomer.id && mapStatusToApi(t.status) === "pending",
          )
        : [],
    [selectedCustomer?.id, transactions],
  );

  const selectedOutstanding = useMemo(() => {
    if (!selectedCustomer) return 0;
    const list = transactions.filter((t) => t.customerId === selectedCustomer.id);
    return list
      .filter((t) => mapStatusToApi(t.status) === "pending")
      .reduce((sum, t) => sum + (Number(t.amount) - Number(t.amountPaid || 0)), 0);
  }, [selectedCustomer?.id, transactions]);

  /* ---------- Initial load ---------- */
  useEffect(() => {
    (async () => {
      try {
        const cs = await fetchCustomersApi();
        setCustomers(cs);
      } catch (e) {
        console.error(e);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης πελατών.",
          variant: "destructive",
        });
      }
    })();
  }, [toast]);

  /* ---------- Load transactions for selected customer ---------- */
  useEffect(() => {
    if (!selectedCustomer?.id) return;
    txAbortRef.current?.abort();
    const ac = new AbortController();
    txAbortRef.current = ac;
    (async () => {
      try {
        const list = await fetchCustomerTransactions(selectedCustomer.id, ac.signal);
        setTransactions(list);
      } catch (e) {
        if (!ac.signal.aborted) {
          console.error(e);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία φόρτωσης συναλλαγών.",
            variant: "destructive",
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id]);

  /* ---------- Table columns ---------- */
  const columns = [
    { key: "name", label: t.customerName },
    { key: "phone", label: t.phone },
    { key: "afm", label: "ΑΦΜ" },
    { key: "tractor", label: "Τρακτέρ" },
    { key: "debt", label: "Οφειλές" },
  ];

  /* ---------- Customer CRUD ---------- */
  const handleAddCustomer = () => {
    setCurrentCustomer(initialCustomer);
    setInitialDebt(0);
    setIsEditingCustomer(false);
    setIsCustomerDialogOpen(true);
  };
  const handleEditCustomer = (c: Customer) => {
    setCurrentCustomer(c);
    setIsEditingCustomer(true);
    setIsCustomerDialogOpen(true);
  };
  const handleDeleteCustomer = async (id: string) => {
    try {
      await deleteCustomerApi(id);
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      const cs = await fetchCustomersApi();
      setCustomers(cs);
      toast({ title: "Διαγράφηκε", description: "Ο πελάτης διαγράφηκε." });
    } catch (e) {
      console.error(e);
      toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής.", variant: "destructive" });
    }
  };
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = currentCustomer.name?.trim();
    if (!name) {
      toast({
        title: "Σφάλμα",
        description: "Το όνομα είναι υποχρεωτικό.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (isEditingCustomer) {
        await updateCustomerApi(currentCustomer.id, currentCustomer);
        toast({ title: "Ενημερώθηκε", description: "Ο πελάτης ενημερώθηκε." });
      } else {
        const createdId = await createCustomerApi(currentCustomer);
        // Optional opening balance (receivable) -> create a pending transaction
        if (createdId && initialDebt > 0) {
          try {
            await createCustomerTransactionApi({
              customerId: createdId,
              productName: "Υπόλοιπο Έναρξης",
              amount: Number(initialDebt),
              amountPaid: 0,
              date: new Date().toISOString().slice(0, 10),
              status: "pending",
              notes: "Αρχικό υπόλοιπο",
            });
          } catch (e) {
            console.warn("Opening balance transaction failed:", e);
          }
        }
      }
      setIsCustomerDialogOpen(false);
      const cs = await fetchCustomersApi();
      setCustomers(cs);
      if (selectedCustomer?.id) {
        const list = await fetchCustomerTransactions(selectedCustomer.id);
        setTransactions(list);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία αποθήκευσης πελάτη.",
        variant: "destructive",
      });
    }
  };

  /* ---------- Transactions ---------- */
  const filteredCustomerTx = useMemo(() => {
    if (!selectedCustomer) return [];
    let list = transactions.filter((t) => t.customerId === selectedCustomer.id);
    if (txFilter !== "all") {
      list = list.filter((t) => mapStatusToApi(t.status) === txFilter);
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedCustomer, txFilter]);

  const handleAddTx = () => {
    if (!selectedCustomer) return;
    setCurrentTx({ ...emptyTx, customerId: selectedCustomer.id });
    setIsEditingTx(false);
    setIsTxDialogOpen(true);
  };
  const handleEditTx = (tx: CustomerTransaction) => {
    if (mapStatusToApi(tx.status) === "paid") {
      toast({
        title: "Μη επεξεργάσιμο",
        description: "Η συναλλαγή είναι εξοφλημένη.",
        variant: "destructive",
      });
      return;
    }
    setCurrentTx(tx);
    setIsEditingTx(true);
    setIsTxDialogOpen(true);
  };
  const handleDeleteTx = async (id: string) => {
    if (!selectedCustomer?.id) return;
    if (!confirm("Διαγραφή συναλλαγής;")) return;
    try {
      await deleteCustomerTransactionApi(id);
      const list = await fetchCustomerTransactions(selectedCustomer.id);
      setTransactions(list);
      const cs = await fetchCustomersApi();
      setCustomers(cs);
      toast({ title: "Διαγράφηκε", description: "Η συναλλαγή διαγράφηκε." });
    } catch (e) {
      console.error(e);
      toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής.", variant: "destructive" });
    }
  };
  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tx = currentTx;
    if (!tx.customerId || !tx.productName?.trim() || !Number.isFinite(tx.amount)) {
      toast({
        title: "Σφάλμα",
        description: "Προϊόν και ποσό είναι υποχρεωτικά.",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      customerId: tx.customerId,
      productName: tx.productName.trim(),
      amount: Number(tx.amount),
      amountPaid: Number(tx.amountPaid || 0),
      date: tx.date || new Date().toISOString().slice(0, 10),
      status: mapStatusToApi(tx.status),
      notes: tx.notes || "",
    };
    try {
      if (isEditingTx && tx.id) {
        await updateCustomerTransactionApi(tx.id, {
          ...tx,
          status: tx.status,
        });
        toast({ title: "Ενημερώθηκε", description: "Η συναλλαγή ενημερώθηκε." });
      } else {
        await createCustomerTransactionApi(payload);
        toast({ title: "Προστέθηκε", description: "Η συναλλαγή προστέθηκε." });
      }
      setIsTxDialogOpen(false);
      const list = await fetchCustomerTransactions(tx.customerId);
      setTransactions(list);
      const cs = await fetchCustomersApi();
      setCustomers(cs);
    } catch (e) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία αποθήκευσης συναλλαγής.",
        variant: "destructive",
      });
    }
  };

  /* ---------- Payments (Revenue) ---------- */
  const openPaymentForSelected = () => {
    if (!selectedCustomer) return;
    const pending = pendingTxsForSelected
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (pending.length === 0) {
      toast({
        title: "Δεν υπάρχουν εκκρεμείς οφειλές",
        description: "Ο πελάτης δεν έχει ανοιχτές οφειλές.",
      });
      return;
    }
    setCurrentTx(pending[0]);
    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
    setIsPaymentDialogOpen(true);
  };

  const openPaymentForTx = (tx: CustomerTransaction) => {
    setCurrentTx(tx);
    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tx = currentTx;
    if (!tx?.id) return;
    const remaining = Number(tx.amount) - Number(tx.amountPaid || 0);
    const amountNum = parseFloat(String(paymentAmount).replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({ title: "Σφάλμα", description: "Μη έγκυρο ποσό πληρωμής.", variant: "destructive" });
      return;
    }
    if (amountNum > remaining) {
      toast({
        title: "Σφάλμα",
        description: "Το ποσό υπερβαίνει το υπόλοιπο.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createCustomerPaymentApi({
        transactionId: tx.id,
        amount: amountNum,
        date: paymentDate,
        notes: paymentNotes,
      });
      toast({ title: "Επιτυχία", description: "Η είσπραξη καταχωρήθηκε (έσοδο)." });
      setIsPaymentDialogOpen(false);
      // refresh transactions + customers + history
      if (selectedCustomer?.id) {
        const list = await fetchCustomerTransactions(selectedCustomer.id);
        setTransactions(list);
        const cs = await fetchCustomersApi();
        setCustomers(cs);
        setHistoryRefresh((k) => k + 1);
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: e?.message || "Αποτυχία πληρωμής.",
        variant: "destructive",
      });
    }
  };

  /* ---------- CSV export ---------- */
  function exportSelectedTransactionsCSV() {
    if (!selectedCustomer) return;
    const rows = transactions.filter((t) => t.customerId === selectedCustomer.id);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["Date", "Product", "Amount", "Paid", "Status", "Notes"].map(esc).join(",");
    const body = rows
      .map((r) =>
        [r.date, r.productName, r.amount, r.amountPaid, r.status, r.notes].map(esc).join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customer-${selectedCustomer.name}-transactions.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- UI ---------- */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.customers}</h1>
        <p className="text-muted-foreground">{t.manageCustomers}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Customers table */}
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={pagedCustomers}
            onAdd={handleAddCustomer}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
            onSelect={(c: Customer) => setSelectedCustomer(c)}
          />
          <SimplePager page={pageSafe} totalPages={totalPages} onPageChange={setPage} />
        </div>

        {/* Customer details card (parity with Suppliers) */}
        <div>
          {selectedCustomer ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedCustomer.name}</CardTitle>
                    <CardDescription>Πληροφορίες Πελάτη</CardDescription>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    <Users className="mr-1 h-3 w-3" />
                    Πελάτης
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center text-sm">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedCustomer.email || "—"}
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedCustomer.phone || "—"}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Διεύθυνση</h3>
                  <div className="flex items-start text-sm">
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{selectedCustomer.address || "—"}</span>
                  </div>
                </div>

                {(selectedCustomer.afm || selectedCustomer.tractor) && (
                  <div className="space-y-1 text-sm">
                    {selectedCustomer.afm && (
                      <p>
                        <strong>ΑΦΜ:</strong> {selectedCustomer.afm}
                      </p>
                    )}
                    {selectedCustomer.tractor && (
                      <p>
                        <strong>Τρακτέρ:</strong> {selectedCustomer.tractor}
                      </p>
                    )}
                  </div>
                )}

                {selectedCustomer.notes && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Σημειώσεις</h3>
                    <div className="flex items-start text-sm">
                      <FileText className="mr-2 mt-0.5 h-4 w-4 text-muted-foreground" />
                      <span>{selectedCustomer.notes}</span>
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditCustomer(selectedCustomer)}
                    className="flex-1"
                  >
                    Επεξεργασία
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Να διαγραφεί αυτός ο πελάτης;"))
                        handleDeleteCustomer(selectedCustomer.id);
                    }}
                    className="flex-1"
                  >
                    Διαγραφή
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t.noCustomerSelected}</CardTitle>
                <CardDescription>{t.selectCustomer}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Επιλέξτε πελάτη για να δείτε λεπτομέρειες και ενέργειες.
                </p>
                <Button onClick={handleAddCustomer} className="mt-4 w-full">
                  {t.addNewCustomer}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions bar under the table (same layout as Suppliers) */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm text-muted-foreground">
          {selectedCustomer ? (
            <>
              Ενέργειες για:{" "}
              <span className="font-medium text-foreground">{selectedCustomer.name}</span>
            </>
          ) : (
            "Επιλέξτε πελάτη για ενέργειες"
          )}
        </div>
        {selectedCustomer && (
          <div className="text-sm text-muted-foreground">
            Εκκρεμείς συναλλαγές:{" "}
            <span className="font-medium">{pendingTxsForSelected.length}</span> • Υπόλοιπο:{" "}
            <span className="font-medium text-foreground">{eur.format(selectedOutstanding)}</span>
          </div>
        )}
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddTx}
            disabled={!selectedCustomer}
            className="w-full sm:w-auto"
          >
            Προσθήκη Οφειλής
          </Button>
          <Button
            size="sm"
            onClick={openPaymentForSelected}
            disabled={!selectedCustomer || pendingTxsForSelected.length === 0}
            className="w-full sm:w-auto"
          >
            Είσπραξη
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportSelectedTransactionsCSV}
            disabled={!selectedCustomer}
          >
            Εξαγωγή CSV
          </Button>
        </div>
      </div>

      {/* Dialog: Add/Edit Customer */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditingCustomer ? t.editCustomer : t.addNewCustomer}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCustomerSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.customerName} *</Label>
                  <Input
                    id="name"
                    value={currentCustomer.name}
                    onChange={(e) =>
                      setCurrentCustomer({ ...currentCustomer, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">{t.contactPerson}</Label>
                  <Input
                    id="contactPerson"
                    value={currentCustomer.contactPerson}
                    onChange={(e) =>
                      setCurrentCustomer({ ...currentCustomer, contactPerson: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    value={currentCustomer.email}
                    onChange={(e) =>
                      setCurrentCustomer({ ...currentCustomer, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input
                    id="phone"
                    value={currentCustomer.phone}
                    onChange={(e) =>
                      setCurrentCustomer({ ...currentCustomer, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t.address}</Label>
                <Input
                  id="address"
                  value={currentCustomer.address}
                  onChange={(e) =>
                    setCurrentCustomer({ ...currentCustomer, address: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="afm">ΑΦΜ</Label>
                  <Input
                    id="afm"
                    value={currentCustomer.afm}
                    onChange={(e) =>
                      setCurrentCustomer({ ...currentCustomer, afm: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tractor">Τρακτέρ</Label>
                  <Input
                    id="tractor"
                    value={currentCustomer.tractor}
                    onChange={(e) =>
                      setCurrentCustomer({ ...currentCustomer, tractor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={currentCustomer.notes}
                  onChange={(e) =>
                    setCurrentCustomer({ ...currentCustomer, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              {!isEditingCustomer && (
                <div className="space-y-2">
                  <Label htmlFor="opening">Αρχικό Υπόλοιπο (προαιρετικό)</Label>
                  <Input
                    id="opening"
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialDebt}
                    onChange={(e) => setInitialDebt(parseFloat(e.target.value || "0"))}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCustomerDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit">{isEditingCustomer ? t.update : t.add}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add/Edit Transaction */}
      <Dialog open={isTxDialogOpen} onOpenChange={setIsTxDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditingTx ? "Ενημέρωση Συναλλαγής" : t.addTransaction}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTxSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">{t.productName} *</Label>
                <Input
                  id="productName"
                  value={currentTx.productName}
                  onChange={(e) => setCurrentTx({ ...currentTx, productName: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">{t.amount} *</Label>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={String(currentTx.amount)}
                    onChange={(e) =>
                      setCurrentTx({ ...currentTx, amount: parseFloat(e.target.value || "0") })
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
                    value={currentTx.date}
                    onChange={(e) => setCurrentTx({ ...currentTx, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountPaid">Εξοφλημένο Ποσό</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={String(currentTx.amountPaid)}
                  onChange={(e) =>
                    setCurrentTx({ ...currentTx, amountPaid: parseFloat(e.target.value || "0") })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t.status}</Label>
                <Select
                  value={mapStatusToApi(currentTx.status)}
                  onValueChange={(v: "paid" | "pending" | "cancelled") =>
                    setCurrentTx({ ...currentTx, status: mapStatusToUi(v as StatusApi) })
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
                  value={currentTx.notes}
                  onChange={(e) => setCurrentTx({ ...currentTx, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTxDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{isEditingTx ? "Αποθήκευση" : t.addTransaction}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Payment (Revenue) */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Είσπραξη</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit}>
            <div className="grid gap-4 py-4">
              {pendingTxsForSelected.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="chooseTx">Επιλέξτε Οφειλή</Label>
                  <Select
                    value={currentTx?.id || ""}
                    onValueChange={(id) => {
                      const tx = pendingTxsForSelected.find((x) => x.id === id);
                      if (tx) {
                        setCurrentTx(tx);
                        setPaymentAmount("");
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
                  <strong>Προϊόν:</strong> {currentTx.productName}
                </p>
                <p>
                  <strong>Σύνολο:</strong> €{(Number(currentTx.amount) || 0).toLocaleString()}
                </p>
                <p>
                  <strong>Εξοφλημένο:</strong> €
                  {(Number(currentTx.amountPaid) || 0).toLocaleString()}
                </p>
                <p>
                  <strong>Υπόλοιπο:</strong> €
                  {(Number(currentTx.amount) - Number(currentTx.amountPaid) || 0).toLocaleString()}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Ποσό Είσπραξης</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Μέχρι €${(
                    (Number(currentTx.amount) || 0) - (Number(currentTx.amountPaid) || 0)
                  ).toLocaleString()}`}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Ημερομηνία</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Σημειώσεις (προαιρετικά)</Label>
                <Textarea
                  id="paymentNotes"
                  rows={3}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">Καταχώριση Είσπραξης</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payments history (revenue ledger) */}
      <CustomerPaymentHistory
        customerId={selectedCustomer?.id || undefined}
        refreshKey={historyRefresh}
        pageSize={10}
      />
    </div>
  );
}
