import { test, expect } from '@playwright/test';

test.describe('Datasets Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pm-api-key', 'pm_test_key_123');
      localStorage.setItem('pm-workspace', 'default');
    });

    await page.route('**/v1/datasets**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/v1/datasets' && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 1,
                name: 'QA Test Cases',
                row_count: 50,
                created_at: 1714400000,
              },
              {
                id: 2,
                name: 'Support Examples',
                row_count: 120,
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

      if (url.pathname === '/v1/datasets' && route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 3,
            name: 'New Dataset',
            row_count: 2,
            created_at: 1714600000,
          }),
        });
        return;
      }

      if (url.pathname.match(/\/v1\/datasets\/\d+$/) && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            name: 'QA Test Cases',
            row_count: 50,
            created_at: 1714400000,
            preview: [
              {
                id: 1,
                input: { question: 'What is 2+2?' },
                expectedOutput: { answer: '4' },
              },
              {
                id: 2,
                input: { question: 'Capital of France?' },
                expectedOutput: { answer: 'Paris' },
              },
            ],
          }),
        });
        return;
      }

      if (url.pathname.match(/\/v1\/datasets\/\d+$/) && route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.continue();
    });
  });

  test('datasets list page shows table with headers', async ({ page }) => {
    await page.goto('/datasets');
    await expect(page.getByRole('heading', { name: 'Datasets' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Row Count' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created At' })).toBeVisible();
  });

  test('datasets list shows items and search filters', async ({ page }) => {
    await page.goto('/datasets');
    await expect(page.getByText('QA Test Cases')).toBeVisible();
    await expect(page.getByText('Support Examples')).toBeVisible();

    const search = page.getByLabel('Search datasets');
    await search.fill('QA');
    await expect(page.getByText('QA Test Cases')).toBeVisible();
    await expect(page.getByText('Support Examples')).not.toBeVisible();
  });

  test('create dataset navigates to form and submits', async ({ page }) => {
    await page.goto('/datasets');
    await page.getByRole('link', { name: /Create Dataset/i }).click();
    await expect(page).toHaveURL(/.*\/datasets\/new/);
    await expect(page.getByRole('heading', { name: 'Create Dataset' })).toBeVisible();

    await page.getByLabel('Name').fill('My New Dataset');
    await page.getByLabel('Rows').fill(JSON.stringify([
      { input: { question: 'Hello?' }, expectedOutput: { answer: 'Hi!' } },
    ]));

    await page.getByRole('button', { name: 'Create Dataset' }).click();
    await expect(page).toHaveURL(/.*\/datasets$/);
  });

  test('dataset preview dialog opens and shows rows', async ({ page }) => {
    await page.goto('/datasets');
    await page.getByRole('button', { name: /View details for QA Test Cases/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Dataset Preview')).toBeVisible();
    await expect(page.getByText('QA Test Cases — 50 rows')).toBeVisible();
    await expect(page.getByText('What is 2+2?')).toBeVisible();
    await expect(page.getByText('Capital of France?')).toBeVisible();
  });
});
