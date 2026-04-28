"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, LabelItem } from "@/lib/api";
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
import { Input } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function LabelsPage() {
  const [page, setPage] = useState(1);
  const [promptName, setPromptName] = useState("");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["labels", promptName, page],
    queryFn: () =>
      promptName
        ? api.getLabels(promptName, { page, limit: LIMIT })
        : Promise.resolve(null),
    enabled: !!promptName,
  });

  const createMutation = useMutation({
    mutationFn: (vars: { promptName: string; name: string; value: string }) =>
      api.createLabel(vars.promptName, { name: vars.name, value: vars.value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      setOpen(false);
      setNewName("");
      setNewValue("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { promptName: string; labelName: string }) =>
      api.deleteLabel(vars.promptName, vars.labelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newValue.trim() || !promptName) return;
    createMutation.mutate({
      promptName,
      name: newName,
      value: newValue,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="pm-h3">Labels</h1>
          {promptName && (
            <Button size="sm" onClick={() => setOpen(true)}>Add Label</Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-sm">
            <UILabel htmlFor="prompt-filter">Prompt Name</UILabel>
            <Input
              id="prompt-filter"
              value={promptName}
              onChange={(e) => {
                setPromptName(e.target.value);
                setPage(1);
              }}
              placeholder="Enter prompt name to view labels"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load labels: {error.message}
          </div>
        )}

        {!promptName ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Enter a prompt name above to view its labels.
          </div>
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: LIMIT }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : !data || data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No labels found for this prompt.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((item: LabelItem) => (
                    <TableRow key={`${item.prompt_name}-${item.name}`}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.version_tag || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(item.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            deleteMutation.mutate({
                              promptName: item.prompt_name,
                              labelName: item.name,
                            })
                          }
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

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

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Label</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <UILabel htmlFor="label-name">Name</UILabel>
                <Input
                  id="label-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. production"
                  required
                />
              </div>
              <div className="space-y-2">
                <UILabel htmlFor="label-value">Value</UILabel>
                <Input
                  id="label-value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g. approved"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
