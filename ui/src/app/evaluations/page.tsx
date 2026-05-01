"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScoreTrendChart } from "@/components/charts/ScoreTrendChart";
import { Plus, Search } from "lucide-react";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function StatusBadge({ item }: { item: EvaluationItem }) {
  const hasCriteria =
    item.criteria && Object.keys(item.criteria).length > 0;
  return hasCriteria ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline">Draft</Badge>
  );
}

export default function EvaluationsPage() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

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

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const term = search.toLowerCase();
    return data.items.filter(
      (item: EvaluationItem) =>
        item.name.toLowerCase().includes(term) ||
        item.prompt_name.toLowerCase().includes(term)
    );
  }, [data, search]);

  const selectedEvaluation = useMemo(() => {
    if (!selectedId || !data?.items) return null;
    return (
      data.items.find((item: EvaluationItem) => item.id === selectedId) ||
      null
    );
  }, [selectedId, data]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="pm-h3">Evaluations</h1>
          <Link
            href="/evaluations/new"
            className={buttonVariants({ size: "sm" }) + " w-full sm:w-auto"}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Evaluation
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search by name or prompt..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
              aria-label="Search evaluations"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load evaluations: {error.message}
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Name</TableHead>
                  <TableHead className="min-w-[160px]">Prompt</TableHead>
                  <TableHead className="w-[120px]">Version</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[160px]">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: LIMIT }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      {search.trim()
                        ? "No evaluations match your search."
                        : "No evaluations found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: EvaluationItem) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(item.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View trend for ${item.name}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.prompt_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.version_tag || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge item={item} />
                      </TableCell>
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

        {data && data.totalPages > 1 && !search.trim() && (
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

        <Dialog
          open={selectedId !== null}
          onOpenChange={() => setSelectedId(null)}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Evaluation Trend</DialogTitle>
              {selectedEvaluation && (
                <p className="text-sm text-muted-foreground">
                  {selectedEvaluation.name} — {selectedEvaluation.prompt_name}
                </p>
              )}
            </DialogHeader>
            {trendData && trendData.evaluations.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card/50 p-4">
                  <ScoreTrendChart data={trendData.evaluations[0].trend} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-card/50 p-8 text-center">
                <p className="text-muted-foreground">
                  No trend data available.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
