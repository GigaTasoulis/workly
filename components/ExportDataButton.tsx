"use client";
import { Button } from "@/components/ui/button";

export function ExportDataButton({ ownerId }: { ownerId: string }) {
  const handleExport = async () => {
    if (!ownerId) return; // guard

    const qs = new URLSearchParams({ ownerId });
    const res = await fetch(`/api/export?${qs.toString()}`, { method: "GET" });
    if (!res.ok) {
      console.error("Export failed:", await res.text());
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_${ownerId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button onClick={handleExport} className="w-full" disabled={!ownerId}>
      Εξαγωγή Δεδομένων
    </Button>
  );
}
