import { trace } from '@opentelemetry/api';
import { config } from '@config/index';

export function logMetadata(metadata: Record<string, unknown>): void {
  const span = trace.getActiveSpan();

  if (span) {
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        span.setAttribute(`metadata.${key}`, value);
      } else {
        span.setAttribute(`metadata.${key}`, JSON.stringify(value));
      }
    }
  }

  if (!config.otelEnabled) {
    return;
  }
}
