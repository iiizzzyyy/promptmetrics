"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface RiskDistributionCardProps {
  low: number;
  medium: number;
  high: number;
  critical: number;
  isLoading?: boolean;
}

export function RiskDistributionCard({ low, medium, high, critical, isLoading }: RiskDistributionCardProps) {
  const total = low + medium + high + critical;
  const segments = [
    { label: "Low", value: low, color: "bg-[#389438]", textColor: "text-[#5cc15c]" },
    { label: "Medium", value: medium, color: "bg-amber-400", textColor: "text-amber-400" },
    { label: "High", value: high, color: "bg-orange-400", textColor: "text-orange-400" },
    { label: "Critical", value: critical, color: "bg-destructive", textColor: "text-destructive" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Risk Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-4 w-full rounded-full" />
        ) : total > 0 ? (
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {segments.map(
              (segment) =>
                segment.value > 0 && (
                  <div
                    key={segment.label}
                    className={`${segment.color} transition-all`}
                    style={{ width: `${(segment.value / total) * 100}%` }}
                    title={`${segment.label}: ${segment.value}`}
                  />
                )
            )}
          </div>
        ) : (
          <div className="h-3 w-full rounded-full bg-muted" />
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${segment.color}`} aria-hidden="true" />
                <span className="text-muted-foreground">{segment.label}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className={`font-medium ${segment.textColor}`}>{segment.value}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
