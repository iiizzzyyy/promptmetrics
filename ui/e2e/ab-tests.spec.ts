import { test, expect } from '@playwright/test';

test.describe('A/B Tests Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pm-api-key', 'pm_test_key_123');
      localStorage.setItem('pm-workspace', 'default');
    });

    await page.route('**/v1/ab-tests**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/v1/ab-tests' && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 1,
                prompt_name: 'qa-prompt',
                version_a: 'v1.0.0',
                version_b: 'v1.1.0',
                dataset_id: null,
                status: 'completed',
                metric: 'latency',
                created_at: 1714400000,
                updated_at: 1714400000,
              },
              {
                id: 2,
                prompt_name: 'support-bot',
                version_a: 'v2.0.0',
                version_b: 'v2.1.0',
                dataset_id: 1,
                status: 'running',
                metric: 'win_rate',
                created_at: 1714500000,
                updated_at: 1714500000,
              },
            ],
            total: 2,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        });
        return;
      }

      if (url.pathname.match(/\/v1\/ab-tests\/\d+$/) && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            prompt_name: 'qa-prompt',
            version_a: 'v1.0.0',
            version_b: 'v1.1.0',
            dataset_id: null,
            status: 'completed',
            metric: 'latency',
            created_at: 1714400000,
            updated_at: 1714400000,
            latest_result: {
              id: 1,
              ab_test_id: 1,
              version_a_score: 0.045,
              version_b_score: 0.038,
              p_value: 0.032,
              winner: 'A',
              created_at: 1714400000,
            },
          }),
        });
        return;
      }

      if (url.pathname === '/v1/ab-tests' && route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 3,
            prompt_name: 'new-test',
            version_a: 'v1.0.0',
            version_b: 'v1.1.0',
            dataset_id: null,
            status: 'running',
            metric: 'latency',
            created_at: 1714600000,
            updated_at: 1714600000,
          }),
        });
        return;
      }

      if (url.pathname.match(/\/v1\/ab-tests\/\d+\/run$/) && route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 2,
            ab_test_id: 2,
            version_a_score: 0.05,
            version_b_score: 0.06,
            p_value: 0.12,
            winner: null,
            created_at: 1714600000,
          }),
        });
        return;
      }

      if (url.pathname.match(/\/v1\/ab-tests\/\d+\/promote$/) && route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ winner: 'A', version: 'v1.0.0' }),
        });
        return;
      }

      if (url.pathname.match(/\/v1\/ab-tests\/\d+$/) && route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.continue();
    });
  });

  test('ab tests list page shows table with headers', async ({ page }) => {
    await page.goto('/ab-tests');
    await expect(page.getByRole('heading', { name: 'A/B Tests' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Prompt Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Version A' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Version B' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Metric' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('ab tests list shows items and search filters', async ({ page }) => {
    await page.goto('/ab-tests');
    await expect(page.getByText('qa-prompt')).toBeVisible();
    await expect(page.getByText('support-bot')).toBeVisible();

    const search = page.getByLabel('Search A/B tests');
    await search.fill('qa');
    await expect(page.getByText('qa-prompt')).toBeVisible();
    await expect(page.getByText('support-bot')).not.toBeVisible();
  });

  test('create ab test navigates to form and submits', async ({ page }) => {
    await page.goto('/ab-tests');
    await page.getByRole('link', { name: /Create A\/B Test/i }).click();
    await expect(page).toHaveURL(/.*\/ab-tests\/new/);
    await expect(page.getByRole('heading', { name: 'Create A/B Test' })).toBeVisible();

    await page.getByLabel('Prompt Name').fill('test-prompt');
    await page.getByLabel('Version A').fill('v1.0.0');
    await page.getByLabel('Version B').fill('v1.1.0');
    await page.getByRole('button', { name: 'Create A/B Test' }).click();

    await expect(page).toHaveURL(/.*\/ab-tests$/);
  });

  test('detail dialog opens, shows results, and supports actions', async ({ page }) => {
    await page.goto('/ab-tests');
    await page.getByRole('button', { name: /View details for qa-prompt/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('A/B Test Details')).toBeVisible();
    await expect(page.getByText('qa-prompt — v1.0.0 vs v1.1.0')).toBeVisible();
    await expect(page.getByText('Latest Result')).toBeVisible();
    await expect(page.getByText('Winner')).toBeVisible();
    await expect(page.getByText('A')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
