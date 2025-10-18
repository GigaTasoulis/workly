// components/ui/ImportDataButton.tsx
"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

type TableReport = {
  table: string;
  rowsInFile: number;
  columnsInDB: string[];
  missingColumns: string[];
  extraFields: string[];
  inserted?: number;
};

type ImportReport = {
  dryRun: boolean;
  ok: boolean;
  tablesConsidered: number;
  tablesMissingInDB: string[];
  tablesSkipped: string[];
  tables: TableReport[];
  warnings: string[];
};

export function ImportDataButton({ ownerId }: { ownerId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickFile = () => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsText(file, "utf-8");
    });

  const postImport = async (body: string, commit: boolean): Promise<ImportReport> => {
    const qs = new URLSearchParams();
    if (ownerId) qs.set("ownerId", ownerId);
    qs.set("mode", "merge");
    if (commit) qs.set("commit", "1");

    const res = await fetch(`/api/import?${qs.toString()}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body,
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      /* non-JSON -> fallback below */
    }

    if (data && typeof data === "object" && "ok" in data) {
      if (!data.ok) throw new Error(data.warnings?.join(" | ") || "Import failed");
      return data as ImportReport;
    }
    throw new Error(raw.slice(0, 800) || "Import failed");
  };

  const handleFile = async (file: File) => {
    try {
      const text = await readFileAsText(file);

      // 1) DRY-RUN
      const dry = await postImport(text, false);
      const summary = [
        `Dry run completed.`,
        `Tables considered: ${dry.tablesConsidered}`,
        dry.tablesMissingInDB.length
          ? `Missing tables (skipped): ${dry.tablesMissingInDB.join(", ")}`
          : null,
        dry.tables
          .map(
            (t) =>
              `• ${t.table}: rows=${t.rowsInFile}, missingCols=${t.missingColumns.length}, extraFields=${t.extraFields.length}`,
          )
          .join("\n"),
        dry.warnings.length ? `Warnings: ${dry.warnings.join(" | ")}` : null,
        "",
        `Proceed to COMMIT? This will reinsert data for this account.`,
      ]
        .filter(Boolean)
        .join("\n");

      if (!window.confirm(summary)) return;

      // 2) COMMIT
      const committed = await postImport(text, true);
      const msg = [
        `Import committed successfully.`,
        committed.tables.map((t) => `• ${t.table}: inserted=${t.inserted ?? 0}`).join("\n"),
        committed.warnings.length ? `Warnings: ${committed.warnings.join(" | ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      alert(msg);
    } catch (err) {
      alert(`Import failed: ${(err as Error)?.message ?? String(err)}`);
      console.error(err);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button onClick={pickFile} className="w-full" disabled={!ownerId}>
        Εισαγωγή Δεδομένων
      </Button>
    </>
  );
}
