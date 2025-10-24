"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Props = {
  customerId?: string;
  refreshKey?: number;
  pageSize?: number;
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
}: Props) {
  const { toast } = useToast();
  const [rowsAll, setRowsAll] = useState<PaymentRow[]>([]);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

      // initial slice for current page (likely 1)
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

  return (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-sm">{r.date}</td>
                    <td className="px-6 py-3 text-sm">{eur.format(Number(r.amount || 0))}</td>
                    <td className="px-6 py-3 text-sm">{renderTypeBadge(r.type)}</td>
                    <td className="px-6 py-3 text-sm">{r.notes || "—"}</td>
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
