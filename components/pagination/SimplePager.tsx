"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type SimplePagerProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export default function SimplePager({
  page,
  totalPages,
  onPageChange,
  className,
}: SimplePagerProps) {
  const pageSafe = Math.max(1, Math.min(page, Math.max(1, totalPages)));
  const canPrev = pageSafe > 1;
  const canNext = pageSafe < Math.max(1, totalPages);

  return (
    <div className={`mt-4 flex items-center justify-center space-x-4 ${className ?? ""}`}>
      <Button
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        disabled={!canPrev}
        onClick={() => onPageChange(Math.max(1, pageSafe - 1))}
        aria-label="Previous page"
      >
        ←
      </Button>

      <span className="text-sm font-medium">
        {pageSafe} / {Math.max(1, totalPages)}
      </span>

      <Button
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        disabled={!canNext}
        onClick={() => onPageChange(Math.min(Math.max(1, totalPages), pageSafe + 1))}
        aria-label="Next page"
      >
        →
      </Button>
    </div>
  );
}
