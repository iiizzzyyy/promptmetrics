import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getEnv(key: string, required: boolean = false, defaultValue?: string): string | undefined {
  const value = process.env[key];
  if (required && !value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new Error(`Invalid integer for ${key}: ${value}`);
  return parsed;
}

function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const config = {
  port: getEnvInt('PORT', 3000),
  nodeEnv: getEnv('NODE_ENV', false, 'development') as string,
  apiKeySalt: getEnv('API_KEY_SALT', true) as string,
  driver: getEnv('DRIVER', false, 'filesystem') as 'filesystem' | 'github',
  sqlitePath: getEnv('SQLITE_PATH', false, './data/promptmetrics.db') as string,
  githubRepo: getEnv('GITHUB_REPO') as string | undefined,
  githubToken: getEnv('GITHUB_TOKEN') as string | undefined,
  githubSyncIntervalMs: getEnvInt('GITHUB_SYNC_INTERVAL_MS', 60000),
  otelEnabled: getEnvBool('OTEL_ENABLED', false),
  otelExporterEndpoint: getEnv('OTEL_EXPORTER_OTLP_ENDPOINT') as string | undefined,
};

export type Config = typeof config;
