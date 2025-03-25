"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { setLocalData } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ImportDataButtonProps {
  className?: string;
}

export function ImportDataButton({ className }: ImportDataButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // For each key in data, store it into localStorage
        Object.keys(data).forEach((key) => {
          setLocalData(key, data[key]);
        });
        alert("Data imported successfully. Please refresh the page.");
      } catch (error) {
        alert("Failed to import data. Please check the file format.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Button onClick={() => fileInputRef.current?.click()} className={cn("w-full", className)}>
        Εισαγωγή Δεδομένων
      </Button>
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleImport}
      />
    </>
  );
}
