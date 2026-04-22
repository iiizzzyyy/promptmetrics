export interface PromptFile {
  name: string;
  version: string;
  template: string;
  variables?: Record<string, { type: string; required?: boolean; default?: unknown }>;
  model_config?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
  tags?: string[];
  [key: string]: unknown;
}

export interface PromptVersion {
  name: string;
  version_tag: string;
  commit_sha?: string;
  fs_path?: string;
  created_at: number;
  author?: string;
}

export interface PromptDriver {
  listPrompts(page: number, limit: number): Promise<{ items: string[]; total: number }>;
  getPrompt(name: string, version?: string): Promise<{ content: PromptFile; version: PromptVersion } | undefined>;
  createPrompt(prompt: PromptFile): Promise<PromptVersion>;
  listVersions(name: string, page: number, limit: number): Promise<{ items: PromptVersion[]; total: number }>;
  sync(): Promise<void>;
  search(query: string): Promise<string[]>;
}
