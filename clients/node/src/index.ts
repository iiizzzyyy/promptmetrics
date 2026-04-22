import axios from 'axios';

export interface PromptMetricsConfig {
  baseUrl: string;
  apiKey: string;
}

export interface PromptMessage {
  role: string;
  content: string;
  name?: string;
}

export interface Prompt {
  name: string;
  version: string;
  messages: PromptMessage[];
  variables?: Record<string, { type: string; required?: boolean }>;
  model_config?: Record<string, unknown>;
  tags?: string[];
}

export interface PromptVersion {
  name: string;
  version_tag: string;
  created_at: number;
}

export interface RenderedPrompt {
  content: Prompt;
  version: PromptVersion;
}

export interface LogEntry {
  prompt_name: string;
  version_tag: string;
  provider?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  cost_usd?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PromptMetrics {
  private client: ReturnType<typeof axios.create>;

  constructor(config: PromptMetricsConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ''),
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  prompts = {
    list: async (params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedResponse<PromptVersion>> => {
      const res = await this.client.get<PaginatedResponse<PromptVersion>>('/v1/prompts', { params });
      return res.data;
    },

    get: async (
      name: string,
      options?: { version?: string; variables?: Record<string, string>; render?: boolean },
    ): Promise<RenderedPrompt> => {
      const res = await this.client.get<RenderedPrompt>(`/v1/prompts/${name}`, {
        params: {
          version: options?.version,
          render: options?.render !== false,
          ...Object.fromEntries(
            Object.entries(options?.variables || {}).map(([k, v]) => [`variables[${k}]`, v]),
          ),
        },
      });
      return res.data;
    },

    versions: async (
      name: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<PromptVersion>> => {
      const res = await this.client.get<PaginatedResponse<PromptVersion>>(`/v1/prompts/${name}/versions`, { params });
      return res.data;
    },

    create: async (prompt: Prompt): Promise<PromptVersion> => {
      const res = await this.client.post<PromptVersion>('/v1/prompts', prompt);
      return res.data;
    },
  };

  logs = {
    create: async (entry: LogEntry): Promise<{ id: number; status: string }> => {
      const res = await this.client.post<{ id: number; status: string }>('/v1/logs', entry);
      return res.data;
    },
  };
}
