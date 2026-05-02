export type StreamChunk =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; arguments: string }
  | { type: "metrics"; tokensIn: number; tokensOut: number; latencyMs: number; costUsd: number }
  | { type: "done"; finishReason: string }
  | { type: "error"; message: string; code?: string };

/**
 * Creates an async generator that yields NDJSON chunks from a fetch response.
 * Uses ReadableStream + TextDecoder for real-time token streaming.
 * Supports AbortController for cancellation.
 */
export async function* createSSEStream(
  url: string,
  options?: RequestInit
): AsyncGenerator<StreamChunk> {
  const apiKey =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("pm-api-key") || "")
      : "";
  const workspaceId =
    typeof window !== "undefined"
      ? (sessionStorage.getItem("pm-workspace") || "default")
      : "default";

  const timeoutSignal = AbortSignal.timeout(60_000);
  const mergedSignal = options?.signal
    ? AbortSignal.any([timeoutSignal, options.signal])
    : timeoutSignal;

  const res = await fetch(url, {
    ...options,
    signal: mergedSignal,
    headers: {
      Accept: "application/x-ndjson",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
      ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  if (!res.body) {
    throw new Error("No response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as StreamChunk;
          yield parsed;
        } catch {
          // Malformed line — skip or yield as error token
          console.warn("Malformed NDJSON line:", trimmed);
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as StreamChunk;
        yield parsed;
      } catch {
        // Ignore trailing malformed content
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Wraps createSSEStream in a Promise that collects all tokens into a single string.
 * For non-streaming use cases.
 */
export async function runPlaygroundStream(
  url: string,
  options?: RequestInit
): Promise<{
  output: string;
  metrics: StreamChunk & { type: "metrics" } | null;
  error: string | null;
}> {
  const tokens: string[] = [];
  let metrics: (StreamChunk & { type: "metrics" }) | null = null;
  let error: string | null = null;

  for await (const chunk of createSSEStream(url, options)) {
    switch (chunk.type) {
      case "token":
        tokens.push(chunk.content);
        break;
      case "metrics":
        metrics = chunk;
        break;
      case "error":
        error = chunk.message;
        break;
      case "done":
        break;
      case "tool_call":
        tokens.push(`\n[Tool call: ${chunk.name}]\n`);
        break;
    }
  }

  return { output: tokens.join(""), metrics, error };
}
