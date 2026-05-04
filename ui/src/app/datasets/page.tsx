"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DatasetItem, DatasetDetail } from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Database, Plus, Search, Trash2 } from "lucide-react";
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
import { Toaster, toast } from "sonner";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function DatasetsPage() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["datasets", page],
    queryFn: () => api.getDatasets({ page, limit: LIMIT }),
  });

  const { data: detailData } = useQuery({
    queryKey: ["dataset", selectedId],
    queryFn: () =>
      selectedId ? api.getDataset(selectedId) : Promise.resolve(null),
    enabled: selectedId !== null,
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const term = search.toLowerCase();
    return data.items.filter((item: DatasetItem) =>
      item.name.toLowerCase().includes(term)
    );
  }, [data, search]);

  const selectedDataset = useMemo(() => {
    if (!selectedId || !data?.items) return null;
    return (
      data.items.find((item: DatasetItem) => item.id === selectedId) || null
    );
  }, [selectedId, data]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteDataset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setSelectedId(null);
      toast.success("Dataset deleted successfully.");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete dataset: ${err.message}`);
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="pm-h3">Datasets</h1>
          <Link
            href="/datasets/new"
            className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full sm:w-auto"}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Dataset
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
              placeholder="Search by name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
              aria-label="Search datasets"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load datasets: {error.message}
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Name</TableHead>
                  <TableHead className="w-[120px]">Row Count</TableHead>
                  <TableHead className="w-[160px]">Created At</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
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
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-8"
                    >
                      {search.trim()
                        ? "No datasets match your search."
                        : "No datasets found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: DatasetItem) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(item.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${item.name}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.row_count}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(item.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Delete ${item.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(item.id);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
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
              <DialogTitle>Dataset Preview</DialogTitle>
              {selectedDataset && (
                <p className="text-sm text-muted-foreground">
                  {selectedDataset.name} — {selectedDataset.row_count} rows
                </p>
              )}
            </DialogHeader>
            {detailData ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card/50 overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>Input</TableHead>
                          <TableHead>Expected Output</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.preview.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center text-muted-foreground py-8"
                            >
                              No preview rows available.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailData.preview.map((row, idx) => (
                            <TableRow key={row.id}>
                              <TableCell className="text-muted-foreground text-sm">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-w-[280px]">
                                  {JSON.stringify(row.input, null, 2)}
                                </pre>
                              </TableCell>
                              <TableCell>
                                {row.expectedOutput ? (
                                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-w-[280px]">
                                    {JSON.stringify(row.expectedOutput, null, 2)}
                                  </pre>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-card/50 p-8 text-center">
                <p className="text-muted-foreground">Loading preview...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Toaster />
        <AlertDialog
          open={confirmDeleteId !== null}
          onOpenChange={() => setConfirmDeleteId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Dataset</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this dataset? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmDeleteId !== null) {
                    deleteMutation.mutate(confirmDeleteId);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
