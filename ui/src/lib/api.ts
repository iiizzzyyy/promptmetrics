const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...((options?.headers || {}) as Record<string, string>),
    },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) q.set(k, String(v));
    }
  }
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export type TimeSeriesPoint = {
  date: string;
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  error_rate: number;
};

export type TimeSeriesResponse = {
  window: string;
  start: number;
  end: number;
  daily: TimeSeriesPoint[];
};

export type PromptMetric = {
  prompt_name: string;
  version_tag: string;
  request_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  error_rate: number;
};

export type PromptMetricsResponse = {
  window: string;
  prompts: PromptMetric[];
};

export type EvaluationTrendPoint = {
  date: string;
  avg_score: number;
  result_count: number;
  min_score: number;
  max_score: number;
};

export type EvaluationTrend = {
  evaluation_id: number;
  name: string;
  prompt_name: string;
  trend: EvaluationTrendPoint[];
};

export type EvaluationTrendsResponse = {
  window: string;
  evaluations: EvaluationTrend[];
};

export type ActivitySummary = {
  total_runs: number;
  total_traces: number;
  total_logs: number;
  total_evaluations: number;
  active_prompts: number;
  failed_runs: number;
};

export type ActivityResponse = {
  window: string;
  summary: ActivitySummary;
  recent_runs: {
    items: Array<{
      run_id: string;
      workflow_name: string;
      status: string;
      created_at: number;
      updated_at: number;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type PromptItem = {
  name: string;
};

export type PromptVersion = {
  name: string;
  version_tag: string;
  commit_sha?: string;
  driver?: string;
  status: string;
  created_at: number;
};

export type PromptFile = {
  name: string;
  version: string;
  messages: Array<{ role: string; content: string }>;
  variables?: Record<string, unknown>;
};

export type PromptDetail = {
  content: PromptFile;
  version: PromptVersion;
};

export type LogEntry = {
  id: number;
  prompt_name: string;
  version_tag: string;
  model?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  latency_ms?: number | null;
  cost_usd?: number | null;
  created_at: number;
};

export type TraceItem = {
  trace_id: string;
  prompt_name: string | null;
  version_tag: string | null;
  metadata: Record<string, unknown>;
  created_at: number;
};

export type SpanItem = {
  span_id: string;
  parent_id: string | null;
  name: string;
  status: string;
  start_time: number | null;
  end_time: number | null;
  metadata: Record<string, unknown>;
  created_at: number;
};

export type TraceDetail = {
  trace_id: string;
  prompt_name: string | null;
  version_tag: string | null;
  metadata: Record<string, unknown>;
  created_at: number;
  spans: SpanItem[];
};

export type RunItem = {
  run_id: string;
  workflow_name: string;
  status: string;
  input: unknown | null;
  output: unknown | null;
  trace_id: string | null;
  metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
};

export type LabelItem = {
  id?: number;
  prompt_name: string;
  name: string;
  version_tag: string;
  created_at: number;
};

export type EvaluationItem = {
  id: number;
  name: string;
  description?: string;
  prompt_name: string;
  version_tag?: string;
  criteria?: Record<string, unknown>;
  created_at: number;
};

export const api = {
  getHealth: () => fetchJson<{ status: string }>("/health"),
  getDeepHealth: () =>
    fetchJson<{ status: string; checks: unknown }>("/health/deep"),

  getPrompts: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<PromptItem>>(`/v1/prompts${buildQuery(params)}`),
  getPrompt: (name: string) =>
    fetchJson<PromptDetail>(`/v1/prompts/${encodeURIComponent(name)}`),
  getLogs: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<LogEntry>>(`/v1/logs${buildQuery(params)}`),
  getTraces: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<TraceItem>>(`/v1/traces${buildQuery(params)}`),
  getTrace: (traceId: string) =>
    fetchJson<TraceDetail>(`/v1/traces/${encodeURIComponent(traceId)}`),
  getRuns: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<RunItem>>(`/v1/runs${buildQuery(params)}`),
  getRun: (runId: string) =>
    fetchJson<RunItem>(`/v1/runs/${encodeURIComponent(runId)}`),
  getEvaluations: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<EvaluationItem>>(
      `/v1/evaluations${buildQuery(params)}`
    ),
  getEvaluation: (id: number) =>
    fetchJson<EvaluationItem>(`/v1/evaluations/${id}`),
  getLabels: (promptName: string, params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<LabelItem>>(`/v1/prompts/${encodeURIComponent(promptName)}/labels${buildQuery(params)}`),
  getAuditLogs: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<unknown>>(
      `/v1/audit-logs${buildQuery(params)}`
    ),

  createLabel: (promptName: string, data: { name: string; value: string }) =>
    fetchJson<LabelItem>(`/v1/prompts/${encodeURIComponent(promptName)}/labels`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteLabel: (promptName: string, labelName: string) =>
    fetchJson<unknown>(`/v1/prompts/${encodeURIComponent(promptName)}/labels/${encodeURIComponent(labelName)}`, { method: "DELETE" }),

  getMetricsTimeSeries: (params?: { window?: string }) =>
    fetchJson<TimeSeriesResponse>(
      `/v1/metrics/time-series${buildQuery(params)}`
    ),
  getMetricsPrompts: (params?: { window?: string; limit?: number }) =>
    fetchJson<PromptMetricsResponse>(
      `/v1/metrics/prompts${buildQuery(params)}`
    ),
  getMetricsEvaluations: (params?: { window?: string; evaluation_id?: number }) =>
    fetchJson<EvaluationTrendsResponse>(
      `/v1/metrics/evaluations${buildQuery(params)}`
    ),
  getMetricsActivity: (params?: { window?: string; page?: number; limit?: number }) =>
    fetchJson<ActivityResponse>(
      `/v1/metrics/activity${buildQuery(params)}`
    ),
};
