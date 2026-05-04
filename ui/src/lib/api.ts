import { getClientCsrfToken } from "@/lib/csrf";

const API_BASE = "/api/proxy";

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export class ApiError extends Error {
  status: number;
  statusText: string;
  body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`API error: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(10000)
      : undefined;

  let signal: AbortSignal | undefined = timeoutSignal;
  if (options?.signal && timeoutSignal) {
    signal =
      typeof AbortSignal !== "undefined" && "any" in AbortSignal
        ? AbortSignal.any([timeoutSignal, options.signal])
        : options.signal;
  } else if (options?.signal) {
    signal = options.signal;
  }

  const csrfToken = getClientCsrfToken();
  const isMutating = options?.method && options.method !== "GET" && options.method !== "HEAD";

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    signal,
    headers: {
      ...(isMutating && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options?.headers || {}),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new ApiError(res.status, res.statusText, body);
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
  log_error_rate: number;
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

export type EvalRunItem = {
  id: number;
  evaluation_id: number;
  dataset_id?: number;
  status: string;
  score?: number;
  created_at: number;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  prompt_name?: string | null;
  version_tag?: string | null;
  api_key_name: string;
  ip_address: string;
  timestamp: number;
  workspace_id?: string | null;
};

export type LLMModel = {
  id: string;
  provider: string;
  name: string;
  slug: string;
};

export type ABTestItem = {
  id: number;
  prompt_name: string;
  version_a: string;
  version_b: string;
  dataset_id: number | null;
  evaluation_id: number | null;
  status: 'running' | 'completed' | 'cancelled';
  metric: string;
  created_at: number;
  updated_at: number;
};

export type ABTestResultItem = {
  id: number;
  ab_test_id: number;
  version_a_score: number | null;
  version_b_score: number | null;
  p_value: number | null;
  winner: string | null;
  ci_lower: number | null;
  ci_upper: number | null;
  stddev_a: number | null;
  stddev_b: number | null;
  created_at: number;
};

export type ABTestWithResult = ABTestItem & {
  latest_result?: ABTestResultItem;
};

export type DatasetItem = {
  id: number;
  name: string;
  row_count: number;
  created_at: number;
};

export type DatasetRow = {
  id: number;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
};

export type DatasetDetail = DatasetItem & {
  preview: DatasetRow[];
};

export type ComplianceScoreItem = {
  id?: number;
  prompt_name: string;
  version_tag: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  violations: Array<{
    rule: string;
    severity: string;
    category: string;
    matchedText: string;
  }>;
  provider: string;
  flagged: boolean;
  categories: string[];
  created_at: number;
};

export const api = {
  getHealth: () => fetchJson<{ status: string }>("/health"),
  getDeepHealth: () =>
    fetchJson<{
      status: string;
      checks: Record<string, string>;
      dbType: "sqlite" | "postgresql";
      dbConnected: boolean;
      driverType: string;
      gitSyncLastRun?: number | null;
      reconciliationRunning: boolean;
    }>("/health/deep"),

  getPrompts: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<PromptItem>>(`/v1/prompts${buildQuery(params)}`),
  getPendingPrompts: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<PromptVersion>>(`/v1/prompts/pending${buildQuery(params)}`),
  getPrompt: (name: string) =>
    fetchJson<PromptDetail>(`/v1/prompts/${encodeURIComponent(name)}?render=false`),
  getPromptVersions: (name: string, params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<PromptVersion>>(`/v1/prompts/${encodeURIComponent(name)}/versions${buildQuery(params)}`),
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
  createEvaluation: (data: {
    name: string;
    description?: string;
    prompt_name: string;
    version_tag?: string;
  }) =>
    fetchJson<EvaluationItem>("/v1/evaluations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  runEvaluation: (id: number, data?: { dataset_id?: string }) =>
    fetchJson<EvalRunItem>(`/v1/evaluations/${id}/run`, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  getLabels: (promptName: string, params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<LabelItem>>(`/v1/prompts/${encodeURIComponent(promptName)}/labels${buildQuery(params)}`),
  getAuditLogs: (params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    fetchJson<PaginatedResponse<AuditLogEntry>>(
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

  getPlaygroundModels: () =>
    fetchJson<PaginatedResponse<LLMModel>>("/v1/playground/models"),

  getABTests: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<ABTestItem>>(`/v1/ab-tests${buildQuery(params)}`),
  getABTest: (id: number) =>
    fetchJson<ABTestWithResult>(`/v1/ab-tests/${id}`),
  createABTest: (data: {
    prompt_name: string;
    version_a: string;
    version_b: string;
    dataset_id?: number;
    metric?: string;
  }) =>
    fetchJson<ABTestItem>("/v1/ab-tests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  runABTest: (id: number) =>
    fetchJson<ABTestResultItem>(`/v1/ab-tests/${id}/run`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  promoteABTest: (id: number) =>
    fetchJson<{ winner: 'A' | 'B' | 'tie'; version: string | null }>(
      `/v1/ab-tests/${id}/promote`,
      { method: "POST" }
    ),
  deleteABTest: (id: number) =>
    fetchJson<unknown>(`/v1/ab-tests/${id}`, { method: "DELETE" }),

  getDatasets: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<DatasetItem>>(`/v1/datasets${buildQuery(params)}`),
  getDataset: (id: number) =>
    fetchJson<DatasetDetail>(`/v1/datasets/${id}`),
  createDataset: (data: {
    name: string;
    rows: Array<{ input: Record<string, unknown>; expectedOutput?: Record<string, unknown> }>;
  }) =>
    fetchJson<DatasetItem>("/v1/datasets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteDataset: (id: number) =>
    fetchJson<unknown>(`/v1/datasets/${id}`, { method: "DELETE" }),

  scanCompliance: (data: {
    prompt_name: string;
    version_tag: string;
    text: string;
  }) =>
    fetchJson<ComplianceScoreItem>("/v1/compliance/scan", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getComplianceScores: (params?: { page?: number; limit?: number }) =>
    fetchJson<PaginatedResponse<ComplianceScoreItem>>(
      `/v1/compliance/scores${buildQuery(params)}`
    ),
  getComplianceScore: (id: number) =>
    fetchJson<ComplianceScoreItem>(`/v1/compliance/scores/${id}`),
};
