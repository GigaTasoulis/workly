"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HistoryRow = {
  id: string;
  supplierId: string;
  supplierName?: string;
  transactionId?: string;
  productName?: string;
  type?: "payment" | "debt";
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
};

type Props = {
  supplierId?: string;
  refreshKey?: number;
  pageSize?: number;
};

export default function SupplierPaymentHistory({
  supplierId,
  refreshKey = 0,
  pageSize = 10,
}: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // simple UI state
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // fetch suppliers (map id->name) so we can show name column nicely
  const [supplierNameById, setSupplierNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/suppliers", { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        const map: Record<string, string> = {};
        for (const s of data.suppliers || []) {
          map[String(s.id)] = String(s.name);
        }
        if (!cancelled) setSupplierNameById(map);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch payments + debts, merge and sort
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Build query once
        const qs = new URLSearchParams();
        if (supplierId) qs.set("supplierId", supplierId);

        // 1) Payments
        const payUrl = `/api/supplier-payments${qs.toString() ? `?${qs}` : ""}`;
        const payRes = await fetch(payUrl, { credentials: "include", cache: "no-store" });
        const payJson = await payRes.json();
        if (!payRes.ok) throw new Error(payJson?.error || "Failed to load payments");

        const paymentList: any[] = payJson.payments || [];
        const payments: HistoryRow[] = paymentList.map((p) => ({
          id: String(p.id),
          supplierId: String(p.supplier_id ?? p.supplierId),
          supplierName: p.supplier_name ? String(p.supplier_name) : undefined,
          transactionId: p.transaction_id ? String(p.transaction_id) : undefined,
          productName: p.product_name ? String(p.product_name) : undefined,
          type: "payment",
          amount: Number(p.amount) || 0,
          date: String(p.date),
          notes: p.notes != null ? String(p.notes) : "",
        }));

        // 2) Debts (supplier transactions)
        // NOTE: If your API uses a different endpoint or parameter (e.g., supplier_id),
        // adjust the URL/param below accordingly.
        const debtUrl = `/api/supplier-transactions${qs.toString() ? `?${qs}` : ""}`;
        const debtRes = await fetch(debtUrl, { credentials: "include", cache: "no-store" });
        const debtJson = await debtRes.json();
        if (!debtRes.ok) throw new Error(debtJson?.error || "Failed to load debts");

        const debtList: any[] = debtJson.transactions || debtJson.debts || [];
        const debts: HistoryRow[] = debtList.map((t) => ({
          id: `tx:${String(t.id)}`,
          supplierId: String(t.supplier_id ?? t.supplierId),
          supplierName: t.supplier_name ? String(t.supplier_name) : undefined,
          transactionId: String(t.id),
          productName: t.product_name ? String(t.product_name) : undefined,
          type: "debt",
          amount: Number(t.amount) || 0,
          date: String(t.date),
          notes: t.notes != null ? String(t.notes) : "",
        }));

        // 3) Merge & sort
        const merged = [...payments, ...debts].sort((a, b) => {
          const dt = new Date(b.date).getTime() - new Date(a.date).getTime();
          return sortOrder === "desc" ? dt : -dt;
        });

        if (!cancelled) {
          setRows(merged);
          setPage(1); // reset to first page on reload
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // include sortOrder so refetch resort respects current choice
  }, [supplierId, refreshKey, sortOrder]);

  // delete a **payment** row (we do NOT delete debts here)
  const handleDelete = async (id: string) => {
    if (!confirm("Να διαγραφεί αυτή η κίνηση;")) return;
    try {
      const r = await fetch(`/api/supplier-payments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Αποτυχία διαγραφής");
      // remove locally
      setRows((arr) => arr.filter((x) => x.id !== id));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Αποτυχία διαγραφής");
    }
  };

  // derived: search + sort (client-side)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = rows.slice();

    if (term) {
      list = list.filter((r) =>
        [
          r.supplierName || supplierNameById[r.supplierId] || "Unknown",
          r.productName || "",
          r.notes || "",
          r.type === "payment" ? "πληρωμή" : r.type === "debt" ? "οφειλή" : "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }

    // ensure current sort order is applied even if upstream fetch didn't run
    list.sort((a, b) =>
      sortOrder === "desc"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return list;
  }, [rows, search, sortOrder, supplierNameById]);

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageStart = (pageSafe - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    // if filters or list changes, keep page in range
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Ιστορικό Προμηθευτή</h2>

      <div className="mb-4 flex gap-4">
        {/* Sort order */}
        <Select
          value={sortOrder}
          onValueChange={(v: "asc" | "desc") => {
            setSortOrder(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Ταξινόμηση" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Νεότερες</SelectItem>
            <SelectItem value="asc">Παλαιότερες</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <Input
          className="w-full md:max-w-sm"
          placeholder="Αναζήτηση προμηθευτή/προϊόντος/σημειώσεων..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Προμηθευτής
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Συναλλαγή
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Προϊόν
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ποσό
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ημ/νία
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Σημειώσεις
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {loading ? (
              <tr>
                <td className="px-6 py-4 text-sm" colSpan={7}>
                  Φόρτωση…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-sm" colSpan={7}>
                  Δεν υπάρχουν εγγραφές.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const name = r.supplierName || supplierNameById[r.supplierId] || "Unknown";
                const kind = r.type === "payment" ? "Πληρωμή" : r.type === "debt" ? "Οφειλή" : "—";
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-50">
                      {name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm dark:text-gray-50">
                      {kind}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm dark:text-gray-50">
                      {r.productName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm dark:text-gray-50">
                      €{Number(r.amount || 0).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm dark:text-gray-50">
                      {r.date}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm dark:text-gray-50">
                      {r.notes || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        {r.type === "payment" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(r.id)}
                            title="Διαγραφή"
                          >
                            Διαγραφή
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-center space-x-4">
          <Button
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            disabled={pageSafe === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </Button>
          <span className="text-sm font-medium">
            {pageSafe} / {totalPages}
          </span>
          <Button
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            disabled={pageSafe >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
