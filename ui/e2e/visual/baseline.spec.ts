import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/playground', name: 'playground' },
  { path: '/compliance', name: 'compliance' },
  { path: '/datasets', name: 'datasets' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const THEMES = ['dark', 'light'] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pm-api-key', 'pm_test_key_123');
    localStorage.setItem('pm-workspace', 'default');
  });

  // Dashboard mocks
  await page.route('**/v1/metrics/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        window: '7d',
        summary: {
          total_runs: 42,
          total_traces: 128,
          total_logs: 1024,
          total_evaluations: 5,
          active_prompts: 12,
          failed_runs: 3,
        },
        recent_runs: {
          items: [
            {
              run_id: 'run-001',
              workflow_name: 'customer-support',
              status: 'completed',
              created_at: 1714400000,
              updated_at: 1714400100,
            },
            {
              run_id: 'run-002',
              workflow_name: 'billing-bot',
              status: 'failed',
              created_at: 1714300000,
              updated_at: 1714300100,
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      }),
    });
  });

  await page.route('**/v1/metrics/time-series**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        window: '7d',
        start: 1713800000,
        end: 1714400000,
        daily: [
          {
            date: '2024-04-22',
            request_count: 120,
            total_tokens: 45000,
            total_cost_usd: 0.12,
            avg_latency_ms: 145,
            p50_latency_ms: 130,
            p95_latency_ms: 280,
            error_rate: 0.02,
            log_error_rate: 0.01,
          },
          {
            date: '2024-04-23',
            request_count: 150,
            total_tokens: 52000,
            total_cost_usd: 0.15,
            avg_latency_ms: 132,
            p50_latency_ms: 120,
            p95_latency_ms: 250,
            error_rate: 0.01,
            log_error_rate: 0.005,
          },
        ],
      }),
    });
  });

  await page.route('**/v1/metrics/prompts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        window: '7d',
        prompts: [
          {
            prompt_name: 'customer-support',
            version_tag: 'v1.2.0',
            request_count: 340,
            total_tokens_in: 12000,
            total_tokens_out: 45000,
            total_cost_usd: 0.18,
            avg_latency_ms: 145,
            error_rate: 0.02,
          },
          {
            prompt_name: 'billing-bot',
            version_tag: 'v2.0.0',
            request_count: 210,
            total_tokens_in: 8000,
            total_tokens_out: 28000,
            total_cost_usd: 0.11,
            avg_latency_ms: 112,
            error_rate: 0.01,
          },
        ],
      }),
    });
  });

  await page.route('**/v1/metrics/evaluations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        window: '7d',
        evaluations: [
          {
            evaluation_id: 1,
            name: 'Accuracy Score',
            prompt_name: 'qa-prompt',
            trend: [
              {
                date: '2024-04-22',
                avg_score: 0.85,
                result_count: 12,
                min_score: 0.6,
                max_score: 0.98,
              },
              {
                date: '2024-04-23',
                avg_score: 0.88,
                result_count: 15,
                min_score: 0.65,
                max_score: 0.99,
              },
            ],
          },
        ],
      }),
    });
  });

  await page.route('**/health/deep', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'healthy',
        checks: {},
        dbType: 'sqlite',
        dbConnected: true,
        driverType: 'filesystem',
        gitSyncLastRun: 1714400000,
        reconciliationRunning: false,
      }),
    });
  });

  // Playground mocks
  await page.route('**/v1/playground/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', slug: 'gpt-4o' },
          { id: 'claude-sonnet', provider: 'anthropic', name: 'Claude 3.5 Sonnet', slug: 'claude-3-5-sonnet-20241022' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      }),
    });
  });

  // Compliance mocks
  await page.route('**/v1/compliance/scores**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 1,
            prompt_name: 'customer-support',
            version_tag: 'v1.0.0',
            score: 95,
            risk_level: 'low',
            violations: [],
            created_at: 1714400000,
          },
          {
            id: 2,
            prompt_name: 'billing-bot',
            version_tag: 'v1.1.0',
            score: 55,
            risk_level: 'high',
            violations: [
              { rule: 'Credit Card Number', severity: 'high', category: 'pii', matchedText: '4111-1111-1111-1111' },
            ],
            created_at: 1714500000,
          },
        ],
        total: 2,
        page: 1,
        limit: 1000,
        totalPages: 1,
      }),
    });
  });

  // Datasets mocks
  await page.route('**/v1/datasets**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v1/datasets' && route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 1, name: 'QA Test Cases', row_count: 50, created_at: 1714400000 },
            { id: 2, name: 'Support Examples', row_count: 120, created_at: 1714500000 },
          ],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      return;
    }
    await route.continue();
  });
});

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`baseline: ${route.name} — ${viewport.name} — ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        await page.goto(route.path, { waitUntil: 'networkidle' });

        // Apply theme
        await page.evaluate((t) => {
          const html = document.documentElement;
          if (t === 'light') {
            html.classList.remove('dark');
            html.setAttribute('data-theme', 'light');
          } else {
            html.classList.add('dark');
            html.setAttribute('data-theme', 'dark');
          }
        }, theme);

        // Wait for any theme transition / re-render
        await page.waitForTimeout(500);

        const snapshotName = `${route.name}-${viewport.name}-${theme}.png`;
        await expect(page).toHaveScreenshot(snapshotName, {
          fullPage: true,
        });
      });
    }
  }
}
