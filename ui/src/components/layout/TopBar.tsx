"use client";

import { cn } from "@/lib/utils";

export const TopBar = ({ className }: { className?: string }) => {
  return (
    <header
      className={cn(
        "h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-30",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="pm-eyebrow">PromptMetrics</span>
        <span className="text-sm text-muted-foreground">Observability</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-muted border border-border" />
      </div>
    </header>
  );
};
