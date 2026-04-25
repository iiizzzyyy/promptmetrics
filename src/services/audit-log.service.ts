import { getDb } from '@models/promptmetrics-sqlite';

export interface AuditLogEntry {
  action: string;
  prompt_name?: string;
  version_tag?: string;
  api_key_name: string;
  ip_address: string;
}

class AuditLogService {
  private buffer: AuditLogEntry[] = [];
  private readonly maxBufferSize = 100;
  private flushIntervalMs = 5000;
  private timer: ReturnType<typeof setInterval> | null = null;

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
      this.flush().catch((err) => console.error('Audit log flush failed:', err));
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    const db = getDb();
    const stmt = db.prepare(
      'INSERT INTO audit_logs (action, prompt_name, version_tag, api_key_name, ip_address) VALUES (?, ?, ?, ?, ?)',
    );

    for (const entry of batch) {
      try {
        stmt.run(
          entry.action,
          entry.prompt_name || null,
          entry.version_tag || null,
          entry.api_key_name,
          entry.ip_address,
        );
      } catch (err) {
        console.error('Failed to write audit log entry:', err);
      }
    }
  }
}

export const auditLogService = new AuditLogService();
