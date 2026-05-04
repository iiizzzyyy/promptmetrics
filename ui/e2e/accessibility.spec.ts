import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/playground', '/compliance', '/datasets'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pm-api-key', 'pm_test_key_123');
    localStorage.setItem('pm-workspace', 'default');
  });

  // Dashboard
  await page.route('**/v1/metrics/activity**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ window: '7d', summary: { total_runs: 0, total_traces: 0, total_logs: 0, total_evaluations: 0, active_prompts: 0, failed_runs: 0 }, recent_runs: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } }) });
  });
  await page.route('**/v1/metrics/time-series**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ window: '7d', start: 0, end: 0, daily: [] }) });
  });
  await page.route('**/v1/metrics/prompts**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ window: '7d', prompts: [] }) });
  });
  await page.route('**/v1/metrics/evaluations**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ window: '7d', evaluations: [] }) });
  });
  await page.route('**/health/deep', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy', checks: {}, dbType: 'sqlite', dbConnected: true, driverType: 'filesystem', gitSyncLastRun: null, reconciliationRunning: false }) });
  });

  // Playground
  await page.route('**/v1/playground/models', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, limit: 50, totalPages: 0 }) });
  });

  // Compliance
  await page.route('**/v1/compliance/scores**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, limit: 1000, totalPages: 0 }) });
  });

  // Datasets
  await page.route('**/v1/datasets**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }) });
  });
});

for (const pageUrl of PAGES) {
  test(`axe-core on ${pageUrl}`, async ({ page }) => {
    await page.goto(pageUrl, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
}
