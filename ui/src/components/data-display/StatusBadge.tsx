"use client";

import { Badge } from "@/components/ui/badge";

export interface StatusBadgeProps {
  status: "running" | "completed" | "failed" | "pending" | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const lower = status.toLowerCase();

  let variantClass = "";
  if (lower === "completed") {
    variantClass = "bg-[#389438]/15 text-[#5cc15c] border-[#389438]/30";
  } else if (lower === "failed") {
    variantClass = "bg-destructive/15 text-destructive border-destructive/30";
  } else if (lower === "running") {
    variantClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  } else {
    variantClass = "bg-muted text-muted-foreground border-border";
  }

  return (
    <Badge
      variant="outline"
      role="status"
      className={`capitalize ${variantClass}`}
    >
      {status}
    </Badge>
  );
}
