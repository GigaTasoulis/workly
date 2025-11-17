"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  customerId?: string;
  refreshKey?: number;
  pageSize?: number;
  onChanged?: () => void; // 🔹 parent asks to refresh when something changes
};

type PaymentRow = {
  id: string;
  user_id?: string;
  customer_id?: string;
  transaction_id?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string | null;
  type?: "payment" | "debt" | string;
  created_at?: number;
};

export default function CustomerPaymentHistory({
  customerId,
  refreshKey = 0,
  pageSize = 10,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const [rowsAll, setRowsAll] = useState<PaymentRow[]>([]);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Edit dialog state
  const [editRow, setEditRow] = useState<PaymentRow | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

  const eur = useMemo(
    () => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }),
    [],
  );

  // Reset to page 1 when customer changes
  useEffect(() => {
    setPage(1);
  }, [customerId]);

  // Fetch payments + debts, merge and sort (newest first)
  async function fetchAll() {
    if (!customerId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);

    try {
      const paymentsReq = fetch(
        `/api/customer-payments?customer_id=${encodeURIComponent(customerId)}`,
        { credentials: "include", signal: ac.signal },
      );
      const debtsReq = fetch(
        `/api/customer-transactions?customer_id=${encodeURIComponent(customerId)}`,
        { credentials: "include", signal: ac.signal },
      );

      const [paymentsRes, debtsRes] = await Promise.all([paymentsReq, debtsReq]);

      const paymentsJson = await paymentsRes.json();
      const debtsJson = await debtsRes.json();

      if (!paymentsRes.ok) throw new Error(paymentsJson?.error || "Αποτυχία φόρτωσης πληρωμών");
      if (!debtsRes.ok) throw new Error(debtsJson?.error || "Αποτυχία φόρτωσης οφειλών");

      const payments: PaymentRow[] = (Array.isArray(paymentsJson?.payments)
        ? paymentsJson.payments
        : []
      ).map((p: any) => ({
        id: `pay:${p.id}`,
        user_id: p.user_id,
        customer_id: p.customer_id,
        transaction_id: p.transaction_id,
        amount: Number(p.amount) || 0,
        date: p.date,
        notes: p.notes || "",
        type: "payment",
        created_at: p.created_at ? Number(p.created_at) : undefined,
      }));

      const debts: PaymentRow[] = (Array.isArray(debtsJson?.transactions)
        ? debtsJson.transactions
        : []
      ).map((t: any) => ({
        id: `tx:${t.id}`,
        user_id: t.user_id,
        customer_id: t.customer_id,
        transaction_id: t.id,
        amount: Number(t.amount) || 0,
        date: t.date,
        notes: t.notes || "",
        type: "debt",
        created_at: t.created_at ? Number(t.created_at) : undefined,
      }));

      const merged = [...payments, ...debts].sort((a, b) => {
        const dt = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dt !== 0) return dt;
        return (b.created_at || 0) - (a.created_at || 0);
      });

      setRowsAll(merged);
      setTotal(merged.length);

      const start = (page - 1) * pageSize;
      setRows(merged.slice(start, start + pageSize));
    } catch (e: any) {
      if (!ac.signal.aborted) {
        const msg = e?.message || "Αποτυχία φόρτωσης ιστορικού πελάτη";
        setError(msg);
        toast({ title: "Σφάλμα", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  // Fetch when customer, refresh key, or page size changes
  useEffect(() => {
    if (customerId) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, refreshKey, pageSize]);

  // Re-slice when page, pageSize, or data changes
  useEffect(() => {
    if (!rowsAll.length) {
      setRows([]);
      return;
    }
    const start = (page - 1) * pageSize;
    setRows(rowsAll.slice(start, start + pageSize));
  }, [rowsAll, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ----- Delete payment -----
  const handleDeletePayment = async (row: PaymentRow) => {
    const amount = Number(row.amount) || 0;

    const confirmed = window.confirm(
      `Η διαγραφή αυτής της είσπραξης ποσού ${eur.format(
        amount,
      )} θα επαναφέρει αυτό το ποσό στην οφειλή του πελάτη. Θέλετε σίγουρα να συνεχίσετε;`,
    );
    if (!confirmed) return;

    const rawId = row.id.startsWith("pay:") ? row.id.slice(4) : row.id;

    try {
      const res = await fetch(`/api/customer-payments/${encodeURIComponent(rawId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok) {
        throw new Error(body?.error || "Αποτυχία διαγραφής είσπραξης");
      }

      // Update local history
      setRowsAll((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((prev) => Math.max(0, prev - 1));

      toast({
        title: "Διαγράφηκε",
        description: "Η είσπραξη διαγράφηκε και η οφειλή του πελάτη ενημερώθηκε.",
      });

      if (onChanged) onChanged();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: e?.message || "Αποτυχία διαγραφής είσπραξης",
        variant: "destructive",
      });
    }
  };

  // ----- Open edit dialog for payment -----
  const openEditPayment = (row: PaymentRow) => {
    if (row.type !== "payment") return;
    setEditRow(row);
    setEditAmount(String(row.amount ?? ""));
    setEditDate(row.date || "");
    setEditNotes(row.notes || "");
  };

  // ----- Submit edit payment -----
  const handleEditPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow) return;

    const rawId = editRow.id.startsWith("pay:") ? editRow.id.slice(4) : editRow.id;
    const amountNum = parseFloat(String(editAmount).replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({
        title: "Σφάλμα",
        description: "Μη έγκυρο ποσό.",
        variant: "destructive",
      });
      return;
    }
    if (!editDate || !/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
      toast({
        title: "Σφάλμα",
        description: "Η ημερομηνία πρέπει να είναι σε μορφή YYYY-MM-DD.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/customer-payments/${encodeURIComponent(rawId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          date: editDate,
          notes: editNotes,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error || "Αποτυχία ενημέρωσης είσπραξης");
      }

      toast({
        title: "Ενημερώθηκε",
        description: "Η είσπραξη ενημερώθηκε και οι οφειλές προσαρμόστηκαν.",
      });

      setEditRow(null);

      // Refresh history data to reflect new amount/date
      await fetchAll();

      // Ask parent to refresh customers/transactions/dashboard
      if (onChanged) onChanged();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: e?.message || "Αποτυχία ενημέρωσης είσπραξης",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Ιστορικό Πελάτη</CardTitle>
              <CardDescription>Εμφανίζονται κινήσεις για τον επιλεγμένο πελάτη.</CardDescription>
            </div>
            <Badge variant="outline" className="ml-2">
              {total} εγγραφ{total === 1 ? "ή" : "ές"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {!customerId ? (
            <p className="text-sm text-muted-foreground">
              Επιλέξτε πελάτη για να δείτε το ιστορικό πελάτη.
            </p>
          ) : loading ? (
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν εγγραφές.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider">
                      Ημ/νία
                    </th>
                    <th className="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider">
                      Ποσό
                    </th>
                    <th className="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider">
                      Τύπος
                    </th>
                    <th className="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider">
                      Σημειώσεις
                    </th>
                    <th className="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider">
                      Ενέργειες
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-6 py-3 text-sm">{r.date}</td>
                      <td className="px-6 py-3 text-sm">
                        {eur.format(Number(r.amount || 0))}
                      </td>
                      <td className="px-6 py-3 text-sm">{renderTypeBadge(r.type)}</td>
                      <td className="px-6 py-3 text-sm">{r.notes || "—"}</td>
                      <td className="px-6 py-3 text-sm">
                        {r.type === "payment" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditPayment(r)}
                            >
                              Επεξ.
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeletePayment(r)}
                            >
                              Διαγραφή
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between p-3">
                <span className="text-xs text-muted-foreground">
                  Σελίδα {page} από {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                  >
                    Προηγούμενη
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    Επόμενη
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit payment dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Επεξεργασία Είσπραξης</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditPaymentSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editAmount">Ποσό *</Label>
                <Input
                  id="editAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDate">Ημ/νία *</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNotes">Σημειώσεις</Label>
                <Textarea
                  id="editNotes"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                Ακύρωση
              </Button>
              <Button type="submit">Αποθήκευση</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- helpers ---------- */

function renderTypeBadge(type?: string) {
  const t = (type || "payment") as "payment" | "debt" | string;
  if (t === "debt") {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
        Οφειλή
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
      Είσπραξη
    </Badge>
  );
}
