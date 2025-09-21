"use client";

import { Button } from "@/components/ui/button";
import { getLocalData } from "@/lib/utils";

export function ExportDataButton() {
  const handleExport = () => {
    const keys = [
      "employees",
      "customers",
      "transactions",
      "suppliers",
      "workplaces",
      "payments",
      "worklogs",
    ];
    const data = {};
    keys.forEach((key) => {
      data[key] = getLocalData(key) || [];
    });
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
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
