// components/TransactionList.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Transaction {
  id: string;
  customerId: string;
  productName: string;
  amount: number;
  amountPaid: number;
  date: string;
  status: "paid" | "pending" | "cancelled";
  notes: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
  onPayment: (transaction: Transaction) => void;
  // Optionally you could pass a helper for getting a status color style:
  getStatusColor?: (status: string) => string;
}

const ITEMS_PER_PAGE = 3;

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onEdit,
  onDelete,
  onPayment,
  getStatusColor = () => "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
}) => {
  // Internal states for pagination, filtering, and sorting.
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Apply filtering and sorting
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (search.trim()) {
      filtered = filtered.filter((t) =>
        t.productName.toLowerCase().includes(search.trim().toLowerCase())
      );
    }
    filtered.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === "asc" ? diff : -diff;
    });
    return filtered;
  }, [transactions, search, sortOrder]);

  // Pagination logic:
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const currentTransactions = useMemo(
    () =>
      filteredTransactions.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [filteredTransactions, currentPage]
  );

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  // Whenever the filter or sort changes, reset the pagination:
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div>
      {/* Filter & Sort Controls */}
      <div className="flex justify-between items-center mb-4">
        <Input
          type="text"
          placeholder="Αναζήτησε συναλλαγή"
          value={search}
          onChange={handleSearchChange}
          className="w-1/2"
        />
        <Select
          value={sortOrder}
          onValueChange={(value) => {
            setSortOrder(value as "asc" | "desc");
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Πιο πρόσφατη</SelectItem>
            <SelectItem value="asc">Παλαιότερη</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {currentTransactions.map((transaction) => (
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
                €{(Number(transaction.amount) || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Εξοφλημένο: €{(Number(transaction.amountPaid) || 0).toLocaleString()} / €
                {(Number(transaction.amount) || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Υπόλοιπο: €
                {(Number(transaction.amount) - Number(transaction.amountPaid)).toLocaleString()}
              </p>
              {transaction.notes && (
                <p className="text-sm text-muted-foreground mt-2">{transaction.notes}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(transaction)}>
                Επεξεργασία
              </Button>
              {transaction.status === "pending" &&
                transaction.amountPaid < transaction.amount && (
                  <Button size="sm" variant="secondary" onClick={() => onPayment(transaction)}>
                    Πληρωμή
                  </Button>
                )}
              <Button size="sm" variant="destructive" onClick={() => onDelete(transaction.id)}>
                Διαγραφή
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-4 space-x-4">
          <Button size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
            ←
          </Button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <Button size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
            →
          </Button>
        </div>
      )}
    </div>
  );
};
