"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export interface ComplianceQuickSummaryProps {
  totalScans: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalRisk: number;
  isLoading?: boolean;
}

export function ComplianceQuickSummary({
  totalScans,
  lowRisk,
  mediumRisk,
  highRisk,
  criticalRisk,
  isLoading,
}: ComplianceQuickSummaryProps) {
  const items = [
    { label: "Total Scans", value: totalScans, icon: Shield, color: "text-muted-foreground" },
    { label: "Low Risk", value: lowRisk, icon: CheckCircle, color: "text-[#5cc15c]" },
    { label: "Medium Risk", value: mediumRisk, icon: AlertTriangle, color: "text-amber-400" },
    { label: "High Risk", value: highRisk, icon: AlertTriangle, color: "text-orange-400" },
    { label: "Critical Risk", value: criticalRisk, icon: XCircle, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
            <item.icon className={`w-4 h-4 ${item.color}`} aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="text-2xl font-semibold tracking-tight">
                {item.value.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
