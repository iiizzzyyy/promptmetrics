"use client";

import { Badge } from "@/components/ui/badge";

export interface IntegrityBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function IntegrityBadge({ score, showLabel = true, size = "md" }: IntegrityBadgeProps) {
  let riskLevel: string;
  let variantClass: string;

  if (score >= 90) {
    riskLevel = "low";
    variantClass = "bg-[#389438]/15 text-[#5cc15c] border-[#389438]/30";
  } else if (score >= 70) {
    riskLevel = "medium";
    variantClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  } else if (score >= 40) {
    riskLevel = "high";
    variantClass = "bg-orange-500/15 text-orange-400 border-orange-500/30";
  } else {
    riskLevel = "critical";
    variantClass = "bg-destructive/15 text-destructive border-destructive/30";
  }

  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-0.5";

  return (
    <Badge
      variant="outline"
      className={`capitalize font-semibold ${variantClass} ${sizeClass}`}
      title={`Compliance score: ${score} — ${riskLevel} risk`}
    >
      {showLabel ? `${score} — ${riskLevel}` : `${score}`}
    </Badge>
  );
}
