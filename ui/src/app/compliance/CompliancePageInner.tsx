"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Shield, Search, AlertTriangle, CheckCircle, Eye, Filter } from "lucide-react";
import { ComplianceQuickSummary } from "@/components/compliance/ComplianceQuickSummary";
import { RiskDistributionCard } from "@/components/compliance/RiskDistributionCard";
import { IntegrityBadge } from "@/components/compliance/IntegrityBadge";
import Link from "next/link";

const LIMIT = 20;
const PROVIDERS = ["all", "stub", "llm-guard", "lakera"] as const;
const RISK_LEVELS = ["all", "low", "medium", "high", "critical"] as const;

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

export default function CompliancePageInner() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("search") || "";
  const providerFilter = searchParams.get("provider") || "all";
  const riskFilter = searchParams.get("risk") || "all";
  const selectedId = searchParams.get("row") ? Number(searchParams.get("row")) : null;

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

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item: ComplianceScoreItem) => {
      const matchesSearch = search.trim()
        ? item.prompt_name.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesProvider = providerFilter !== "all" ? item.provider === providerFilter : true;
      const matchesRisk = riskFilter !== "all" ? item.risk_level === riskFilter : true;
      return matchesSearch && matchesProvider && matchesRisk;
    });
  }, [data, search, providerFilter, riskFilter]);

  const {
    data: score,
    isLoading: scoreLoading,
    error: scoreError,
  } = useQuery({
    queryKey: ["compliance-score", selectedId],
    queryFn: () => api.getComplianceScore(selectedId!),
    enabled: selectedId !== null,
  });

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== "page") {
      params.delete("page");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const openRow = (id: number) => {
    setParam("row", String(id));
  };

  const closeRow = () => {
    setParam("row", null);
  };

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
                <Shield className="h-4 w-4 mr-2" aria-hidden="true" />
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
                      <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
                    )}
                    <span className="font-medium">
                      Score: {scanMutation.data.score} — {scanMutation.data.risk_level}
                    </span>
                    {scanMutation.data.provider && (
                      <Badge variant="outline">{scanMutation.data.provider}</Badge>
                    )}
                  </div>
                  {scanMutation.data.flagged && (
                    <p className="text-sm text-destructive">Flagged for review</p>
                  )}
                  {scanMutation.data.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {scanMutation.data.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
                  setParam("search", e.target.value);
                }}
                className="pl-9"
                aria-label="Search compliance scores"
              />
            </div>
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Select value={providerFilter} onValueChange={(v) => setParam("provider", v)}>
                <SelectTrigger className="w-[140px]" aria-label="Filter by provider">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p === "all" ? "All Providers" : p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={(v) => setParam("risk", v)}>
                <SelectTrigger className="w-[140px]" aria-label="Filter by risk level">
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "all" ? "All Risks" : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    <TableHead className="w-[100px]">Provider</TableHead>
                    <TableHead className="w-[100px]">Score</TableHead>
                    <TableHead className="w-[100px]">Risk</TableHead>
                    <TableHead className="w-[140px]">Categories</TableHead>
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
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        {search.trim() || providerFilter !== "all" || riskFilter !== "all"
                          ? "No scores match your filters."
                          : "No compliance scans found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item: ComplianceScoreItem) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() => openRow(item.id ?? 0)}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${item.prompt_name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRow(item.id ?? 0);
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
                          <Badge variant="outline" className="text-xs">
                            {item.provider}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <IntegrityBadge score={item.score} size="sm" />
                        </TableCell>
                        <TableCell>
                          <RiskBadge level={item.risk_level} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.categories.slice(0, 2).map((cat) => (
                              <Badge key={cat} variant="secondary" className="text-xs">
                                {cat}
                              </Badge>
                            ))}
                            {item.categories.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{item.categories.length - 2}
                              </span>
                            )}
                          </div>
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

          {data && data.totalPages > 1 && !search.trim() && providerFilter === "all" && riskFilter === "all" && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setParam("page", String(Math.max(1, page - 1)))}
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
                onClick={() => setParam("page", String(Math.min(data.totalPages, page + 1)))}
                disabled={page >= data.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        <Dialog open={selectedId !== null} onOpenChange={closeRow}>
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
                  <div className="rounded-lg border bg-card/50 p-3">
                    <p className="text-muted-foreground">Provider</p>
                    <p className="font-medium">{score.provider}</p>
                  </div>
                  <div className="rounded-lg border bg-card/50 p-3">
                    <p className="text-muted-foreground">Flagged</p>
                    <p className="font-medium">{score.flagged ? "Yes" : "No"}</p>
                  </div>
                </div>
                {score.categories.length > 0 && (
                  <div className="rounded-lg border bg-card/50 p-3">
                    <p className="text-sm text-muted-foreground mb-2">Categories</p>
                    <div className="flex flex-wrap gap-1">
                      {score.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
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
