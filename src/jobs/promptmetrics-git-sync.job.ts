import { PromptDriver } from '@drivers/promptmetrics-driver.interface';

export class GitSyncJob {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private driver: PromptDriver,
    private intervalMs: number,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    // Run immediately, then on interval
    this.runSync();
    this.timer = setInterval(() => this.runSync(), this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runSync(): Promise<void> {
    try {
      await this.driver.sync();
    } catch (err) {
      console.error('Git sync failed:', (err as Error).message);
    }
  }
}
