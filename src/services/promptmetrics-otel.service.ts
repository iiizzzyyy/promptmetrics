import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from '@config/index';

let sdk: NodeSDK | null = null;

export function initOtel(): void {
  if (!config.otelEnabled || !config.otelExporterEndpoint) {
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: config.otelExporterEndpoint,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'promptmetrics',
    }),
    traceExporter,
  });

  sdk.start();
  console.log('OpenTelemetry initialized. Exporting to:', config.otelExporterEndpoint);
}

export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    console.log('OpenTelemetry shut down.');
  }
}
