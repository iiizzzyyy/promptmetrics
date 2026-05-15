import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/playground', '/compliance', '/datasets', '/ab-tests', '/settings'];

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

  // A/B Tests
  await page.route('**/v1/ab-tests**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }) });
  });
});

for (const route of ROUTES) {
  test(`no console errors on ${route}`, async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    page.on('console', msg => {
      // 404s from unmocked API routes surface as console errors in Chromium;
      // these are expected when running against a stubbed dev server.
      if (msg.type() === 'error' && !/404 \(Not Found\)/.test(msg.text())) errors.push(msg.text());
      if (msg.type() === 'warning' && /hydrat|did not match|Warning:/i.test(msg.text())) warnings.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
}
