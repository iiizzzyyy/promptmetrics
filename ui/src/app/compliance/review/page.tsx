"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, ComplianceScoreItem } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { IntegrityBadge } from "@/components/compliance/IntegrityBadge";
import { ArrowLeft, AlertTriangle } from "lucide-react";

const LIMIT = 50;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function ReviewPromptsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["compliance-review"],
    queryFn: () => api.getComplianceScores({ page: 1, limit: LIMIT }),
  });

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    return [...data.items].sort(
      (a: ComplianceScoreItem, b: ComplianceScoreItem) => a.score - b.score
    );
  }, [data]);

  const needsReview = sortedItems.filter(
    (item: ComplianceScoreItem) => item.score < 70
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/compliance">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Compliance
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="pm-h3">Review Prompts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Prompts sorted by compliance score (lowest first). Items below 70
              need attention.
            </p>
          </div>
          {needsReview.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {needsReview.length} prompt{needsReview.length !== 1 ? "s" : ""} need
              review
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load compliance scores: {error.message}
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Prompt</TableHead>
                  <TableHead className="w-[120px]">Version</TableHead>
                  <TableHead className="w-[120px]">Score</TableHead>
                  <TableHead className="w-[100px]">Violations</TableHead>
                  <TableHead className="w-[160px]">Scanned At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No compliance scans found. Run a scan first.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item: ComplianceScoreItem) => (
                    <TableRow
                      key={item.id}
                      className={
                        item.score < 40
                          ? "bg-destructive/5"
                          : item.score < 70
                          ? "bg-amber-500/5"
                          : undefined
                      }
                    >
                      <TableCell className="font-medium">
                        {item.prompt_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.version_tag}
                      </TableCell>
                      <TableCell>
                        <IntegrityBadge score={item.score} />
                      </TableCell>
                      <TableCell>{item.violations.length}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(item.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
