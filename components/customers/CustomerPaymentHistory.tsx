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

  async function fetchPage(p: number) {
    if (!customerId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const limit = pageSize;
      const offset = (p - 1) * pageSize;
      const res = await fetch(
        `/api/customer-payments?customer_id=${encodeURIComponent(customerId)}&limit=${limit}&offset=${offset}`,
        { credentials: "include", signal: ac.signal },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Αποτυχία φόρτωσης ιστορικού πληρωμών");

      const list: PaymentRow[] = Array.isArray(j?.payments) ? j.payments : [];
      const totalFromApi = typeof j?.total === "number" ? j.total : list.length;

      setRows(list);
      setTotal(totalFromApi);
    } catch (e: any) {
      if (!ac.signal.aborted) {
        setError(e?.message || "Αποτυχία φόρτωσης ιστορικού πληρωμών");
        toast({
          title: "Σφάλμα",
          description: e?.message || "Αποτυχία φόρτωσης ιστορικού πληρωμών.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  // reset to page 1 when customer changes
  useEffect(() => {
    setPage(1);
  }, [customerId]);

  // fetch on page/customer/refresh change
  useEffect(() => {
    if (customerId) fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, page, refreshKey, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Ιστορικό Πληρωμών</CardTitle>
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
            Επιλέξτε πελάτη για να δείτε το ιστορικό πληρωμών.
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
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
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
