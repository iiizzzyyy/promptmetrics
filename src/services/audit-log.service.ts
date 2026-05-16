import { getDb } from '@models/promptmetrics-sqlite';

export interface AuditLogEntry {
  action: string;
  prompt_name?: string;
  version_tag?: string;
  target_id?: string;
  api_key_name: string;
  ip_address: string;
  workspace_id?: string;
}

class AuditLogService {
  private buffer: AuditLogEntry[] = [];
  private readonly maxBufferSize = 100;
  private flushIntervalMs = 5000;
  private timer: ReturnType<typeof setInterval> | null = null;
  private droppedCount = 0;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((err) => console.error('Audit log auto-flush failed:', err));
    }, this.flushIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  enqueue(entry: AuditLogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flushWithRetry().catch((err) => {
        console.error('Audit log flush failed after retries:', err);
      });
    }
  }

  private async flushWithRetry(maxAttempts = 3, delayMs = 100): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.flush();
        return;
      } catch {
        if (attempt === maxAttempts) {
          this.droppedCount += this.buffer.length;
          this.buffer = [];
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    let db;
    try {
      db = getDb();
    } catch (err) {
      // getDb() failed — re-queue the batch so entries aren't lost
      this.buffer.unshift(...batch);
      throw err;
    }

    const failed: AuditLogEntry[] = [];
    for (const entry of batch) {
      try {
        await db.prepare(
          'INSERT INTO audit_logs (action, prompt_name, version_tag, target_id, api_key_name, ip_address, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(
          entry.action,
          entry.prompt_name || null,
          entry.version_tag || null,
          entry.target_id || null,
          entry.api_key_name,
          entry.ip_address,
          entry.workspace_id || 'default',
        );
      } catch (err) {
        console.error('Failed to write audit log entry:', err);
        failed.push(entry);
      }
    }

    if (failed.length > 0) {
      this.droppedCount += failed.length;
      console.error(`Dropped ${failed.length} audit log entries that could not be written`);
    }
  }

  getMetrics(): { droppedCount: number; pendingCount: number } {
    return { droppedCount: this.droppedCount, pendingCount: this.buffer.length };
  }
}

export const auditLogService = new AuditLogService();