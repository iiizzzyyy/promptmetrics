import { test, expect } from '@playwright/test';

test.describe('Evaluations Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pm-api-key', 'pm_test_key_123');
      localStorage.setItem('pm-workspace', 'default');
    });

    await page.route('**/v1/evaluations**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/v1/evaluations' && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 1,
                name: 'QA Accuracy Check',
                description: 'Checks QA responses',
                prompt_name: 'qa-prompt',
                version_tag: 'v1.0.0',
                criteria: { rules: [] },
                created_at: 1714400000,
              },
              {
                id: 2,
                name: 'Support Tone Eval',
                prompt_name: 'support-bot',
                version_tag: null,
                criteria: null,
                created_at: 1714500000,
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

      if (url.pathname === '/v1/evaluations' && route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 3,
            name: 'New Eval',
            description: '',
            prompt_name: 'qa-prompt',
            version_tag: 'v1.0.0',
            criteria: null,
            created_at: 1714600000,
          }),
        });
        return;
      }

      if (url.pathname.match(/\/v1\/evaluations\/\d+$/) && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'QA Accuracy Check',
            description: 'Checks QA responses',
            prompt_name: 'qa-prompt',
            version_tag: 'v1.0.0',
            criteria: { rules: [] },
            created_at: 1714400000,
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/v1/metrics/evaluations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          window: '30d',
          evaluations: [
            {
              evaluation_id: 1,
              name: 'QA Accuracy Check',
              prompt_name: 'qa-prompt',
              trend: [
                { date: '2024-04-01', avg_score: 0.85, result_count: 10, min_score: 0.7, max_score: 0.95 },
                { date: '2024-04-02', avg_score: 0.88, result_count: 12, min_score: 0.75, max_score: 0.96 },
              ],
            },
          ],
        }),
      });
    });

    await page.route('**/v1/prompts**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/v1/prompts' && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ name: 'qa-prompt' }, { name: 'support-bot' }],
            total: 2,
            page: 1,
            limit: 100,
            totalPages: 1,
          }),
        });
        return;
      }
      await route.continue();
    });
  });

  test('evaluations list page shows table with headers', async ({ page }) => {
    await page.goto('/evaluations');
    await expect(page.getByRole('heading', { name: 'Evaluations' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Prompt' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Version' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('evaluations list shows items and search filters', async ({ page }) => {
    await page.goto('/evaluations');
    await expect(page.getByText('QA Accuracy Check')).toBeVisible();
    await expect(page.getByText('Support Tone Eval')).toBeVisible();

    const search = page.getByLabel('Search evaluations');
    await search.fill('QA');
    await expect(page.getByText('QA Accuracy Check')).toBeVisible();
    await expect(page.getByText('Support Tone Eval')).not.toBeVisible();
  });

  test('create evaluation navigates to form and submits', async ({ page }) => {
    await page.goto('/evaluations');
    await page.getByRole('link', { name: /Create Evaluation/i }).click();
    await expect(page).toHaveURL(/.*\/evaluations\/new/);
    await expect(page.getByRole('heading', { name: 'Create Evaluation' })).toBeVisible();

    await page.getByLabel('Name').fill('My New Eval');
    await page.getByLabel('Description').fill('Optional description');

    const promptSelect = page.locator('[aria-label="Select a prompt"]').first();
    await promptSelect.click();
    await page.getByRole('option', { name: 'qa-prompt' }).click();

    await page.getByRole('button', { name: 'Create Evaluation' }).click();
    await expect(page).toHaveURL(/.*\/evaluations$/);
  });

  test('evaluation trend dialog opens and shows chart', async ({ page }) => {
    await page.goto('/evaluations');
    await page.getByRole('button', { name: /View trend for QA Accuracy Check/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Evaluation Trend')).toBeVisible();
    await expect(page.getByText('QA Accuracy Check — qa-prompt')).toBeVisible();
  });
});
