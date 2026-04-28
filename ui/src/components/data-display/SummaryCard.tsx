"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface SummaryCardProps {
  title: string;
  value: number | string;
  trend?: { direction: "up" | "down"; percentage: number } | null;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function SummaryCard({
  title,
  value,
  trend,
  icon,
  isLoading,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
        )}
        {!isLoading && trend && (
          <p
            className={`mt-1 text-xs font-medium inline-flex items-center gap-1 ${
              trend.direction === "up" ? "text-[#5cc15c]" : "text-destructive"
            }`}
          >
            {trend.direction === "up" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
            )}
            {trend.percentage}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
