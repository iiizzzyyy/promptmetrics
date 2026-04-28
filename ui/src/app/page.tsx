"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { TokenBarChart } from "@/components/charts/TokenBarChart";
import { ScoreTrendChart } from "@/components/charts/ScoreTrendChart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Layers,
  FileText,
  Box,
  RotateCcw,
} from "lucide-react";

function formatTimestamp(ts: number): string {
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OverviewPage() {
  const [window, setWindow] = useState<"7d" | "30d" | "90d">("7d");

  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
  } = useQuery({
    queryKey: ["metrics", "activity", window],
    queryFn: () => api.getMetricsActivity({ window }),
  });

  const {
    data: timeSeries,
    isLoading: timeSeriesLoading,
    isError: timeSeriesError,
  } = useQuery({
    queryKey: ["metrics", "time-series", window],
    queryFn: () => api.getMetricsTimeSeries({ window }),
  });

  const {
    data: promptMetrics,
    isLoading: promptsLoading,
    isError: promptsError,
  } = useQuery({
    queryKey: ["metrics", "prompts", window],
    queryFn: () => api.getMetricsPrompts({ window, limit: 10 }),
  });

  const {
    data: evaluations,
    isLoading: evaluationsLoading,
    isError: evaluationsError,
  } = useQuery({
    queryKey: ["metrics", "evaluations", window],
    queryFn: () => api.getMetricsEvaluations({ window }),
  });

  const anyError =
    activityError || timeSeriesError || promptsError || evaluationsError;

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["metrics"] });
  };

  const summary = activity?.summary;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="pm-h2">Dashboard</h1>
          <Tabs value={window} onValueChange={(v) => setWindow(v as "7d" | "30d" | "90d")}>
            <TabsList>
              <TabsTrigger value="7d">7 days</TabsTrigger>
              <TabsTrigger value="30d">30 days</TabsTrigger>
              <TabsTrigger value="90d">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {anyError && (
          <div className="flex items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <span>Failed to load dashboard data.</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Runs"
            value={summary?.total_runs ?? 0}
            icon={<Activity className="h-4 w-4" />}
            isLoading={activityLoading}
          />
          <SummaryCard
            title="Total Traces"
            value={summary?.total_traces ?? 0}
            icon={<Layers className="h-4 w-4" />}
            isLoading={activityLoading}
          />
          <SummaryCard
            title="Active Prompts"
            value={summary?.active_prompts ?? 0}
            icon={<Box className="h-4 w-4" />}
            isLoading={activityLoading}
          />
          <SummaryCard
            title="Total Logs"
            value={summary?.total_logs ?? 0}
            icon={<FileText className="h-4 w-4" />}
            isLoading={activityLoading}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Cost &amp; Latency</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeriesLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <TimeSeriesChart
                data={timeSeries?.daily ?? []}
                lines={[
                  {
                    key: "total_cost_usd",
                    color: "#389438",
                    name: "Cost (USD)",
                  },
                  {
                    key: "avg_latency_ms",
                    color: "#5cc15c",
                    name: "Avg Latency (ms)",
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Top Prompts by Token Usage</CardTitle>
            </CardHeader>
            <CardContent>
              {promptsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <TokenBarChart data={promptMetrics?.prompts ?? []} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Evaluation Trends
                {evaluations && evaluations.evaluations.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — {evaluations.evaluations[0].name}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evaluationsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : evaluations && evaluations.evaluations.length > 0 ? (
                <ScoreTrendChart
                  data={evaluations.evaluations[0].trend}
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  No evaluation data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run ID</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(activity?.recent_runs.items ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No recent runs
                      </TableCell>
                    </TableRow>
                  )}
                  {(activity?.recent_runs.items ?? []).map((run) => (
                    <TableRow key={run.run_id}>
                      <TableCell className="font-mono text-xs">
                        {run.run_id}
                      </TableCell>
                      <TableCell>{run.workflow_name}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(run.created_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(run.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
