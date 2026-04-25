const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface PromptVariable {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
}

export interface ModelConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface OllamaConfig {
  options?: Record<string, unknown>;
  keep_alive?: string;
  format?: string;
}

export interface CreatePromptRequest {
  name: string;
  version: string;
  messages: PromptMessage[];
  variables?: Record<string, PromptVariable>;
  model_config?: ModelConfig;
  ollama?: OllamaConfig;
  tags?: string[];
}

export interface PromptVersion {
  name: string;
  version_tag: string;
  commit_sha?: string;
  fs_path?: string;
  created_at: number;
  author?: string;
}

export interface PromptResponse {
  content?: {
    name?: string;
    version?: string;
    messages?: PromptMessage[];
    variables?: Record<string, PromptVariable>;
    model_config?: ModelConfig;
    ollama?: OllamaConfig;
    tags?: string[];
  };
  version?: PromptVersion;
}

export interface PaginatedPromptList {
  items: Array<{ name: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedVersionList {
  items: PromptVersion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateLogRequest {
  prompt_name: string;
  version_tag: string;
  provider?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  cost_usd?: number;
  ollama_options?: Record<string, unknown>;
  ollama_keep_alive?: string;
  ollama_format?: unknown;
  metadata?: Record<string, unknown>;
}

export interface LogAcceptedResponse {
  id?: number;
  status?: string;
}

export interface CreateTraceRequest {
  trace_id?: string;
  prompt_name?: string;
  version_tag?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface TraceCreatedResponse {
  trace_id: string;
  prompt_name?: string;
  version_tag?: string;
  status?: string;
}

export interface TraceResponse {
  trace_id: string;
  prompt_name?: string;
  version_tag?: string;
  metadata?: Record<string, unknown>;
  created_at?: number;
  spans?: Array<Record<string, unknown>>;
}

export interface CreateSpanRequest {
  span_id?: string;
  parent_id?: string;
  name: string;
  status: 'ok' | 'error';
  start_time?: number;
  end_time?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface SpanCreatedResponse {
  trace_id: string;
  span_id: string;
  name?: string;
  status?: string;
}

export interface CreateRunRequest {
  run_id?: string;
  workflow_name: string;
  status?: 'running' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  trace_id?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface RunCreatedResponse {
  run_id: string;
  workflow_name?: string;
  status?: string;
}

export interface RunResponse {
  run_id: string;
  workflow_name?: string;
  status?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  trace_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: number;
  updated_at?: number;
}

export interface PaginatedRunList {
  items: RunResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateLabelRequest {
  name: string;
  version_tag: string;
}

export interface LabelResponse {
  prompt_name?: string;
  name?: string;
  version_tag?: string;
  created_at?: number;
}

export interface PaginatedLabelList {
  items: LabelResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogEntry {
  id: number;
  action?: string;
  prompt_name?: string;
  version_tag?: string;
  api_key_name?: string;
  ip_address?: string;
  timestamp?: number;
}

export interface PaginatedAuditLogList {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HealthStatus {
  status: string;
}

export interface DeepHealthStatus {
  status: string;
  checks?: Record<string, string>;
}

let apiKey = '';

export function setApiKey(key: string) {
  apiKey = key;
  if (typeof window !== 'undefined') {
    localStorage.setItem('pm_api_key', key);
  }
}

export function getApiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('pm_api_key') || apiKey;
  }
  return apiKey;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const key = getApiKey();
  if (key) {
    headers['X-API-Key'] = key;
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const promptsApi = {
  list: (params?: { page?: number; limit?: number; q?: string }) =>
    api<PaginatedPromptList>(`/v1/prompts?${new URLSearchParams(params as Record<string, string>)}`),
  get: (name: string, params?: { version?: string; render?: string; variables?: Record<string, string> }) => {
    const search = new URLSearchParams();
    if (params?.version) search.set('version', params.version);
    if (params?.render) search.set('render', params.render);
    if (params?.variables) {
      Object.entries(params.variables).forEach(([k, v]) => search.set(`variables[${k}]`, v));
    }
    return api<PromptResponse>(`/v1/prompts/${encodeURIComponent(name)}?${search}`);
  },
  versions: (name: string, params?: { page?: number; limit?: number }) =>
    api<PaginatedVersionList>(`/v1/prompts/${encodeURIComponent(name)}/versions?${new URLSearchParams(params as Record<string, string>)}`),
  create: (body: CreatePromptRequest) => api<PromptVersion>('/v1/prompts', { method: 'POST', body: JSON.stringify(body) }),
};

export const logsApi = {
  create: (body: CreateLogRequest) => api<LogAcceptedResponse>('/v1/logs', { method: 'POST', body: JSON.stringify(body) }),
};

export const tracesApi = {
  create: (body: CreateTraceRequest) => api<TraceCreatedResponse>('/v1/traces', { method: 'POST', body: JSON.stringify(body) }),
  get: (traceId: string) => api<TraceResponse>(`/v1/traces/${traceId}`),
  addSpan: (traceId: string, body: CreateSpanRequest) =>
    api<SpanCreatedResponse>(`/v1/traces/${traceId}/spans`, { method: 'POST', body: JSON.stringify(body) }),
};

export const runsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api<PaginatedRunList>(`/v1/runs?${new URLSearchParams(params as Record<string, string>)}`),
  get: (runId: string) => api<RunResponse>(`/v1/runs/${runId}`),
  create: (body: CreateRunRequest) => api<RunCreatedResponse>('/v1/runs', { method: 'POST', body: JSON.stringify(body) }),
  update: (runId: string, body: Partial<CreateRunRequest>) =>
    api<RunResponse>(`/v1/runs/${runId}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const labelsApi = {
  list: (promptName: string, params?: { page?: number; limit?: number }) =>
    api<PaginatedLabelList>(`/v1/prompts/${encodeURIComponent(promptName)}/labels?${new URLSearchParams(params as Record<string, string>)}`),
  create: (promptName: string, body: CreateLabelRequest) =>
    api<LabelResponse>(`/v1/prompts/${encodeURIComponent(promptName)}/labels`, { method: 'POST', body: JSON.stringify(body) }),
};

export const auditApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api<PaginatedAuditLogList>(`/v1/audit-logs?${new URLSearchParams(params as Record<string, string>)}`),
};

export const healthApi = {
  check: () => api<HealthStatus>('/health'),
  deep: () => api<DeepHealthStatus>('/health/deep'),
};
