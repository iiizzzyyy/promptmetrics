"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, SpanItem } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function formatDuration(start: number | null, end: number | null): string {
  if (start == null || end == null) return "—";
  const ms = (end - start) * 1000;
  return `${ms.toFixed(2)}ms`;
}

function buildSpanTree(spans: SpanItem[]) {
  const byParent: Record<string, SpanItem[]> = {};
  const roots: SpanItem[] = [];
  for (const span of spans) {
    if (span.parent_id) {
      byParent[span.parent_id] = byParent[span.parent_id] || [];
      byParent[span.parent_id].push(span);
    } else {
      roots.push(span);
    }
  }
  return { roots, byParent };
}

function SpanNode({
  span,
  byParent,
  depth = 0,
}: {
  span: SpanItem;
  byParent: Record<string, SpanItem[]>;
  depth?: number;
}) {
  const children = byParent[span.span_id] || [];
  return (
    <div>
      <div
        className="flex items-center justify-between py-2 border-b border-border/50"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
        <div className="flex items-center gap-3">
          {depth > 0 && (
            <span className="text-muted-foreground text-xs">└</span>
          )}
          <span className="text-sm font-medium">{span.name}</span>
          <Badge
            variant={span.status === "ok" ? "default" : "outline"}
            className="text-xs"
          >
            {span.status}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {formatDuration(span.start_time, span.end_time)}
        </span>
      </div>
      {children.map((child) => (
        <SpanNode key={child.span_id} span={child} byParent={byParent} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function TraceDetailPage({
  params,
}: {
  params: Promise<{ trace_id: string }>;
}) {
  const { trace_id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["trace", trace_id],
    queryFn: () => api.getTrace(trace_id),
  });

  const totalDuration =
    data && data.spans.length > 0
      ? formatDuration(
          Math.min(...data.spans.map((s) => s.start_time ?? Infinity)),
          Math.max(...data.spans.map((s) => s.end_time ?? -Infinity))
        )
      : "—";

  const { roots, byParent } = data ? buildSpanTree(data.spans) : { roots: [], byParent: {} };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/traces">
            <Button variant="outline" size="sm">Back</Button>
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load trace: {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div>
              <h1 className="pm-h3">Trace Detail</h1>
              <p className="pm-meta mt-1 font-mono">{data.trace_id}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Trace Info</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="pm-meta">Trace ID</dt>
                    <dd className="text-foreground font-mono">{data.trace_id}</dd>
                  </div>
                  <div>
                    <dt className="pm-meta">Prompt Name</dt>
                    <dd className="text-foreground">{data.prompt_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="pm-meta">Version</dt>
                    <dd className="text-foreground">{data.version_tag || "—"}</dd>
                  </div>
                  <div>
                    <dt className="pm-meta">Duration</dt>
                    <dd className="text-foreground">{totalDuration}</dd>
                  </div>
                  <div>
                    <dt className="pm-meta">Created At</dt>
                    <dd className="text-foreground">{formatDate(data.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="pm-meta">Spans</dt>
                    <dd className="text-foreground">{data.spans.length}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Span Tree</CardTitle>
              </CardHeader>
              <CardContent>
                {data.spans.length === 0 ? (
                  <p className="text-muted-foreground">No spans found.</p>
                ) : (
                  <div>
                    {roots.map((span) => (
                      <SpanNode key={span.span_id} span={span} byParent={byParent} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
