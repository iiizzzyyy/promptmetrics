export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  finishReason: string;
}

export type StreamChunk =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; name: string; arguments: string }
  | { type: 'metrics'; tokensIn: number; tokensOut: number; latencyMs: number; costUsd: number }
  | { type: 'done'; finishReason: string }
  | { type: 'error'; message: string; code?: string };

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
}

export interface LLMProviderAdapter {
  readonly provider: string;
  listModels(): Promise<LLMModel[]>;
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  streamChatCompletion(request: ChatCompletionRequest, signal?: globalThis.AbortSignal): AsyncGenerator<StreamChunk>;
  estimateCost(model: string, tokensIn: number, tokensOut: number): number;
}

export class ProviderError extends Error {
  public readonly provider: string;
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(provider: string, message: string, code: string, retryable = false) {
    super(message);
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    Error.captureStackTrace(this, this.constructor);
  }

  static rateLimit(provider: string): ProviderError {
    return new ProviderError(provider, 'Rate limit exceeded', 'rate_limit', true);
  }

  static contentPolicy(provider: string, message: string): ProviderError {
    return new ProviderError(provider, message, 'content_policy', false);
  }

  static timeout(provider: string): ProviderError {
    return new ProviderError(provider, 'Request timed out', 'timeout', true);
  }

  static invalidRequest(provider: string, message: string): ProviderError {
    return new ProviderError(provider, message, 'invalid_request', false);
  }

  static unknown(provider: string, message: string): ProviderError {
    return new ProviderError(provider, message, 'unknown', false);
  }
}
