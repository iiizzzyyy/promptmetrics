"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, EvaluationItem } from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScoreTrendChart } from "@/components/charts/ScoreTrendChart";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function EvaluationsPage() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["evaluations", page],
    queryFn: () => api.getEvaluations({ page, limit: LIMIT }),
  });

  const { data: trendData } = useQuery({
    queryKey: ["evaluation-trend", selectedId],
    queryFn: () =>
      selectedId
        ? api.getMetricsEvaluations({ evaluation_id: selectedId })
        : Promise.resolve(null),
    enabled: selectedId !== null,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="pm-h3">Evaluations</h1>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load evaluations: {error.message}
          </div>
        )}

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: LIMIT }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : !data || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No evaluations found.
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((item: EvaluationItem) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(item.id)}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.prompt_name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.version_tag || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(item.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
            >
              Next
            </Button>
          </div>
        )}

        <Dialog open={selectedId !== null} onOpenChange={() => setSelectedId(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Evaluation Trend</DialogTitle>
            </DialogHeader>
            {trendData && trendData.evaluations.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {trendData.evaluations[0].name} — {trendData.evaluations[0].prompt_name}
                </p>
                <ScoreTrendChart data={trendData.evaluations[0].trend} />
              </div>
            ) : (
              <p className="text-muted-foreground">No trend data available.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
