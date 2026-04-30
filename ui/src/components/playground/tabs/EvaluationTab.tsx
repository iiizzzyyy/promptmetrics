"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, EvaluationItem } from "@/lib/api";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScoreTrendChart } from "@/components/charts/ScoreTrendChart";
import { Play, BarChart3, Calendar } from "lucide-react";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

interface RunEvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluations: EvaluationItem[];
}

function RunEvaluationDialog({
  open,
  onOpenChange,
  evaluations,
}: RunEvaluationDialogProps) {
  const [evaluationId, setEvaluationId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => submitRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const runMutation = useMutation({
    mutationFn: ({ id, datasetId: dsId }: { id: number; datasetId?: string }) =>
      api.runEvaluation(id, dsId ? { dataset_id: dsId } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      onOpenChange(false);
      setEvaluationId("");
      setDatasetId("");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = Number(evaluationId);
    if (!id || Number.isNaN(id)) {
      setError("Please select an evaluation.");
      return;
    }
    runMutation.mutate({ id, datasetId: datasetId || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run Evaluation</DialogTitle>
          <DialogDescription>
            Select an evaluation to run against the current prompt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="eval-select"
              className="text-sm font-medium block mb-1.5"
            >
              Evaluation
            </label>
            <select
              id="eval-select"
              value={evaluationId}
              onChange={(e) => setEvaluationId(e.target.value)}
              className="flex h-10 w-full rounded-[10px] border border-white/10 bg-[#111] px-3 py-2 text-sm text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#389438]"
              required
            >
              <option value="" disabled>
                Select an evaluation
              </option>
              {evaluations.map((ev) => (
                <option key={ev.id} value={String(ev.id)}>
                  {ev.name} ({ev.prompt_name})
                </option>
              ))}
            </select>
            {evaluations.length === 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                No evaluations available. Create one first.
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="dataset-id"
              className="text-sm font-medium block mb-1.5"
            >
              Dataset ID (optional)
            </label>
            <input
              id="dataset-id"
              type="text"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              className="flex h-10 w-full rounded-[10px] border border-white/10 bg-[#111] px-3 py-2 text-sm text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#389438]"
              placeholder="Enter dataset ID"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              ref={submitRef}
              type="submit"
              loading={runMutation.isPending}
              disabled={!evaluationId || runMutation.isPending}
            >
              <Play className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EvaluationTab() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["evaluations", page],
    queryFn: () => api.getEvaluations({ page, limit: LIMIT }),
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ["evaluation-trend", selectedId],
    queryFn: () =>
      selectedId
        ? api.getMetricsEvaluations({ evaluation_id: selectedId })
        : Promise.resolve(null),
    enabled: selectedId !== null,
  });

  const selectedEvaluation = data?.items.find((e) => e.id === selectedId);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, id: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSelectedId(id);
      }
    },
    []
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Evaluations</h2>
        <Button
          size="sm"
          onClick={() => setIsRunDialogOpen(true)}
          className="gap-1.5"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Run Evaluation
        </Button>
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
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !data || data.items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-8"
                  >
                    No evaluations found.
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((item: EvaluationItem) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(e) => handleRowKeyDown(e, item.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${item.name}`}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.prompt_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.version_tag || "—"}
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
            onClick={() =>
              setPage((p) => Math.min(data.totalPages, p + 1))
            }
            disabled={page >= data.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={selectedId !== null}
        onOpenChange={() => setSelectedId(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            {selectedEvaluation && (
              <DialogDescription>
                {selectedEvaluation.name} — {selectedEvaluation.prompt_name}
                {selectedEvaluation.version_tag
                  ? ` (${selectedEvaluation.version_tag})`
                  : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {trendLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : trendData && trendData.evaluations.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  {trendData.evaluations[0].trend.length} data points
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {trendData.window}
                </span>
              </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Dialog */}
      <RunEvaluationDialog
        open={isRunDialogOpen}
        onOpenChange={setIsRunDialogOpen}
        evaluations={data?.items || []}
      />
    </div>
  );
}
