"use client";
import { Button } from "@/components/ui/button";

export function ExportDataButton() {
  const handleExport = async () => {
    const res = await fetch("/api/export", { method: "GET" });
    if (!res.ok) {
      console.error("Export failed:", await res.text());
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button onClick={handleExport} className="w-full">
      Εξαγωγή Δεδομένων
    </Button>
  );
}
