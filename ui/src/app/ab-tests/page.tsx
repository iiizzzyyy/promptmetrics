"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ABTestItem, ABTestWithResult } from "@/lib/api";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { FlaskConical, Plus, Search, Trash2, Play, Trophy, CheckCircle2 } from "lucide-react";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function StatusBadge({ status }: { status: ABTestItem["status"] }) {
  if (status === "running") {
    return <Badge variant="default">Running</Badge>;
  }
  if (status === "completed") {
    return <Badge variant="secondary">Completed</Badge>;
  }
  return <Badge variant="outline">Cancelled</Badge>;
}

export default function ABTestsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ab-tests", page],
    queryFn: () => api.getABTests({ page, limit: LIMIT }),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["ab-test", selectedId],
    queryFn: () =>
      selectedId ? api.getABTest(selectedId) : Promise.resolve(null),
    enabled: selectedId !== null,
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const term = search.toLowerCase();
    return data.items.filter(
      (item: ABTestItem) =>
        item.prompt_name.toLowerCase().includes(term) ||
        item.version_a.toLowerCase().includes(term) ||
        item.version_b.toLowerCase().includes(term)
    );
  }, [data, search]);

  const selectedTest = useMemo(() => {
    if (!selectedId || !data?.items) return null;
    return (
      data.items.find((item: ABTestItem) => item.id === selectedId) || null
    );
  }, [selectedId, data]);

  const runMutation = useMutation({
    mutationFn: (id: number) => api.runABTest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-test", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (id: number) => api.promoteABTest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ab-test", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteABTest(id),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["ab-tests"] });
    },
  });

  const detail: ABTestWithResult | null = detailData || selectedTest || null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="pm-h3">A/B Tests</h1>
          <Link
            href="/ab-tests/new"
            className={buttonVariants({ size: "sm" }) + " w-full sm:w-auto"}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create A/B Test
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
              placeholder="Search by prompt or version..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
              aria-label="Search A/B tests"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load A/B tests: {error.message}
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Prompt Name</TableHead>
                  <TableHead className="w-[120px]">Version A</TableHead>
                  <TableHead className="w-[120px]">Version B</TableHead>
                  <TableHead className="w-[100px]">Metric</TableHead>
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
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
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
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {search.trim()
                        ? "No A/B tests match your search."
                        : "No A/B tests found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: ABTestItem) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() => setSelectedId(item.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${item.prompt_name}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        {item.prompt_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.version_a}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.version_b}
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {item.metric}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
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
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
                A/B Test Details
              </DialogTitle>
              {detail && (
                <p className="text-sm text-muted-foreground">
                  {detail.prompt_name} — {detail.version_a} vs {detail.version_b}
                </p>
              )}
            </DialogHeader>

            {detailLoading && !detail ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : detail ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="pm-mono-label">Metric</p>
                    <p className="text-sm capitalize">{detail.metric}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="pm-mono-label">Status</p>
                    <StatusBadge status={detail.status} />
                  </div>
                  <div className="space-y-1">
                    <p className="pm-mono-label">Dataset ID</p>
                    <p className="text-sm">
                      {detail.dataset_id ?? "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="pm-mono-label">Created</p>
                    <p className="text-sm">{formatDate(detail.created_at)}</p>
                  </div>
                </div>

                {detail.evaluation_id && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    <Badge variant="default" className="text-xs">Deterministic</Badge>
                    <Link
                      href={`/evaluations/${detail.evaluation_id}`}
                      className="text-sm text-primary hover:underline ml-2"
                    >
                      View Evaluation
                    </Link>
                  </div>
                )}

                {runMutation.isPending && (
                  <div className="rounded-lg border bg-card/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                )}

                {detail.latest_result ? (
                  <div className="rounded-lg border bg-card/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
                      <p className="text-sm font-medium">Latest Result</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="pm-mono-label">Version A Score</p>
                        <p className="text-sm font-medium">
                          {detail.latest_result.version_a_score?.toFixed(4) ?? "—"}
                        </p>
                        {detail.latest_result.stddev_a != null && (
                          <p className="text-xs text-muted-foreground">
                            σ = {detail.latest_result.stddev_a.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="pm-mono-label">Version B Score</p>
                        <p className="text-sm font-medium">
                          {detail.latest_result.version_b_score?.toFixed(4) ?? "—"}
                        </p>
                        {detail.latest_result.stddev_b != null && (
                          <p className="text-xs text-muted-foreground">
                            σ = {detail.latest_result.stddev_b.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="pm-mono-label">P-Value</p>
                        <p className="text-sm font-medium">
                          {detail.latest_result.p_value?.toFixed(4) ?? "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="pm-mono-label">Winner</p>
                        <p className="text-sm font-medium capitalize">
                          {detail.latest_result.winner ?? "—"}
                        </p>
                      </div>
                    </div>
                    {detail.latest_result.ci_lower != null && detail.latest_result.ci_upper != null && (
                      <div className="space-y-1">
                        <p className="pm-mono-label">95% Confidence Interval (difference)</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">[{detail.latest_result.ci_lower.toFixed(4)}, {detail.latest_result.ci_upper.toFixed(4)}]</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Result created at {formatDate(detail.latest_result.created_at)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card/50 p-8 text-center">
                    <p className="text-muted-foreground">
                      No results yet. Run the test to generate scores.
                    </p>
                  </div>
                )}

                {runMutation.isError && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                    Failed to run test: {runMutation.error instanceof Error ? runMutation.error.message : "Unknown error"}
                  </div>
                )}

                {promoteMutation.isError && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                    Failed to promote: {promoteMutation.error instanceof Error ? promoteMutation.error.message : "Unknown error"}
                  </div>
                )}

                {deleteMutation.isError && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                    Failed to delete: {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Unknown error"}
                  </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedId(null)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setConfirmPromote(true)}
                    disabled={promoteMutation.isPending}
                  >
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    {promoteMutation.isPending ? "Promoting..." : "Promote"}
                  </Button>
                  <Button
                    variant="outline-accent"
                    onClick={() => runMutation.mutate(detail.id)}
                    disabled={runMutation.isPending}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {runMutation.isPending ? "Running..." : "Run Test"}
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete A/B Test</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this A/B test? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDelete(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (detail) deleteMutation.mutate(detail.id);
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmPromote} onOpenChange={setConfirmPromote}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Promote A/B Test Winner</AlertDialogTitle>
              <AlertDialogDescription>
                This will promote the winning version to production. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmPromote(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (detail) promoteMutation.mutate(detail.id);
                }}
                disabled={promoteMutation.isPending}
              >
                {promoteMutation.isPending ? "Promoting..." : "Promote"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
