"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, Search, AlertTriangle, CheckCircle, Eye } from "lucide-react";
import { ComplianceQuickSummary } from "@/components/compliance/ComplianceQuickSummary";
import { RiskDistributionCard } from "@/components/compliance/RiskDistributionCard";
import { IntegrityBadge } from "@/components/compliance/IntegrityBadge";
import Link from "next/link";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function RiskBadge({ level }: { level: string }) {
  const variant =
    level === "low"
      ? "default"
      : level === "medium"
      ? "secondary"
      : level === "high"
      ? "secondary"
      : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

function countByRiskLevel(items: ComplianceScoreItem[], level: string): number {
  return items.filter((i) => i.risk_level === level).length;
}

export default function CompliancePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scanForm, setScanForm] = useState({
    prompt_name: "",
    version_tag: "",
    text: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["compliance", page],
    queryFn: () => api.getComplianceScores({ page, limit: LIMIT }),
  });

  const scanMutation = useMutation({
    mutationFn: () =>
      api.scanCompliance({
        prompt_name: scanForm.prompt_name,
        version_tag: scanForm.version_tag,
        text: scanForm.text,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
      setScanForm({ prompt_name: "", version_tag: "", text: "" });
    },
  });

  const filteredItems =
    data?.items.filter((item: ComplianceScoreItem) =>
      search.trim()
        ? item.prompt_name.toLowerCase().includes(search.toLowerCase())
        : true
    ) || [];

  const {
    data: score,
    isLoading: scoreLoading,
    error: scoreError,
  } = useQuery({
    queryKey: ["compliance-score", selectedId],
    queryFn: () => api.getComplianceScore(selectedId!),
    enabled: selectedId !== null,
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="pm-h3">Compliance</h1>
          <Link
            href="/compliance/review"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Review Prompts
          </Link>
        </div>

        {data?.items && (
          <ComplianceQuickSummary
            totalScans={data.items.length}
            lowRisk={countByRiskLevel(data.items, "low")}
            mediumRisk={countByRiskLevel(data.items, "medium")}
            highRisk={countByRiskLevel(data.items, "high")}
            criticalRisk={countByRiskLevel(data.items, "critical")}
            isLoading={isLoading}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold">Scan Prompt</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scan_prompt_name">Prompt Name</Label>
              <Input
                id="scan_prompt_name"
                placeholder="e.g. customer-support"
                value={scanForm.prompt_name}
                onChange={(e) =>
                  setScanForm((f) => ({ ...f, prompt_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scan_version_tag">Version Tag</Label>
              <Input
                id="scan_version_tag"
                placeholder="e.g. v1.0.0"
                value={scanForm.version_tag}
                onChange={(e) =>
                  setScanForm((f) => ({ ...f, version_tag: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scan_text">Text to Scan</Label>
            <Textarea
              id="scan_text"
              placeholder="Paste prompt text here to scan for PII, secrets, and compliance violations..."
              rows={4}
              value={scanForm.text}
              onChange={(e) =>
                setScanForm((f) => ({ ...f, text: e.target.value }))
              }
            />
          </div>
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={
              scanMutation.isPending ||
              !scanForm.prompt_name ||
              !scanForm.version_tag ||
              !scanForm.text
            }
          >
            <Shield className="h-4 w-4 mr-2" />
            {scanMutation.isPending ? "Scanning..." : "Scan"}
          </Button>

          {scanMutation.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Scan failed:{" "}
              {scanMutation.error instanceof Error
                ? scanMutation.error.message
                : "Unknown error"}
            </div>
          )}

          {scanMutation.isSuccess && scanMutation.data && (
            <div className="rounded-lg border bg-card/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                {scanMutation.data.score >= 90 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <span className="font-medium">
                  Score: {scanMutation.data.score} —{" "}
                  {(scanMutation.data as any).riskLevel}
                </span>
              </div>
              {scanMutation.data.violations.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {scanMutation.data.violations.map(
                    (v: { rule: string; severity: string; matchedText: string }, i: number) => (
                      <li key={i} className="text-muted-foreground">
                        {v.rule} ({v.severity}): {v.matchedText}
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          )}
            </div>
          </div>

          <div className="space-y-6">
            <RiskDistributionCard
              low={data?.items ? countByRiskLevel(data.items, "low") : 0}
              medium={data?.items ? countByRiskLevel(data.items, "medium") : 0}
              high={data?.items ? countByRiskLevel(data.items, "high") : 0}
              critical={data?.items ? countByRiskLevel(data.items, "critical") : 0}
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search by prompt name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
                aria-label="Search compliance scores"
              />
            </div>
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
                    <TableHead className="w-[100px]">Score</TableHead>
                    <TableHead className="w-[100px]">Risk</TableHead>
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
                          <Skeleton className="h-4 w-12" />
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
                          ? "No scores match your search."
                          : "No compliance scans found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item: ComplianceScoreItem) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(item.id ?? 0)}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${item.prompt_name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(item.id ?? 0);
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          {item.prompt_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.version_tag}
                        </TableCell>
                        <TableCell>
                          <IntegrityBadge score={item.score} size="sm" />
                        </TableCell>
                        <TableCell>{item.risk_level}</TableCell>
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
        </div>

        <Dialog
          open={selectedId !== null}
          onOpenChange={() => setSelectedId(null)}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Compliance Details</DialogTitle>
            </DialogHeader>
            {scoreLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <Skeleton className="h-24 w-full" />
              </div>
            )}
            {scoreError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load compliance details:{" "}
                {scoreError instanceof Error ? scoreError.message : "Unknown error"}
              </div>
            )}
            {score && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg border bg-card/50 p-3">
                    <p className="text-muted-foreground">Prompt</p>
                    <p className="font-medium">{score.prompt_name}</p>
                  </div>
                  <div className="rounded-lg border bg-card/50 p-3">
                    <p className="text-muted-foreground">Version</p>
                    <p className="font-medium">{score.version_tag}</p>
                  </div>
                  <div className="rounded-lg border bg-card/50 p-3">
                    <p className="text-muted-foreground">Score</p>
                    <p className="font-medium">{score.score}</p>
                  </div>
                  <div className="rounded-lg border bg-card/50 p-3">
                    <p className="text-muted-foreground">Risk Level</p>
                    <p className="font-medium">{score.risk_level}</p>
                  </div>
                </div>
                {score.violations.length > 0 && (
                  <div className="rounded-lg border bg-card/50 p-4">
                    <p className="text-sm font-medium mb-2">Violations</p>
                    <ul className="space-y-2 text-sm">
                      {score.violations.map((v, i) => (
                        <li key={i}>
                          <span className="font-medium">{v.rule}</span>{" "}
                          <span className="text-muted-foreground">({v.severity})</span>:
                          {" "}
                          {v.matchedText}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
