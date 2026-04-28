import { PromptDriver } from '@drivers/promptmetrics-driver.interface';
import { getDb } from '@models/promptmetrics-sqlite';

export class PromptReconciliationJob {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private intervalMs: number;

  constructor(
    private driver: PromptDriver,
    intervalMs?: number,
  ) {
    this.intervalMs = intervalMs || parseInt(process.env.PROMPT_RECONCILE_INTERVAL_MS || '60000', 10);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Run immediately, then on interval
    this.runReconcile();
    this.timer = setInterval(() => this.runReconcile(), this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runReconcile(): Promise<void> {
    try {
      const db = getDb();
      const cutoff = Math.floor(Date.now() / 1000) - 120;
      const rows = (await db
        .prepare('SELECT name, version_tag FROM prompts WHERE status = ? AND created_at < ?')
        .all('pending', cutoff)) as Array<{ name: string; version_tag: string }>;

      for (const row of rows) {
        try {
          const found = await this.driver.getPrompt(row.name, row.version_tag);
          if (found) {
            await db
              .prepare("UPDATE prompts SET status = 'active' WHERE name = ? AND version_tag = ?")
              .run(row.name, row.version_tag);
            console.log(`[Reconciliation] Promoted ${row.name}@${row.version_tag} to active`);
          } else {
            await db
              .prepare('DELETE FROM prompts WHERE name = ? AND version_tag = ?')
              .run(row.name, row.version_tag);
            console.log(`[Reconciliation] Deleted orphaned pending prompt ${row.name}@${row.version_tag}`);
          }
        } catch (err) {
          console.error(
            `[Reconciliation] Failed to reconcile ${row.name}@${row.version_tag}:`,
            (err as Error).message,
          );
        }
      }
    } catch (err) {
      console.error('Reconciliation job failed:', (err as Error).message);
    }
  }
}
