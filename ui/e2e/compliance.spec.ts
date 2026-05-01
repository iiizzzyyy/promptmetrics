import { test, expect } from '@playwright/test';

test.describe('Compliance Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pm-api-key', 'pm_test_key_123');
      localStorage.setItem('pm-workspace', 'default');
    });

    await page.route('**/v1/compliance**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === '/v1/compliance/scores' && route.request().method() === 'GET') {
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
              {
                id: 3,
                prompt_name: 'hr-assistant',
                version_tag: 'v2.0.0',
                score: 25,
                risk_level: 'critical',
                violations: [
                  { rule: 'Email Address', severity: 'medium', category: 'pii', matchedText: 'user@example.com' },
                  { rule: 'SSN Pattern', severity: 'high', category: 'pii', matchedText: '123-45-6789' },
                ],
                created_at: 1714600000,
              },
            ],
            total: 3,
            page: 1,
            limit: 1000,
            totalPages: 1,
          }),
        });
        return;
      }

      if (url.pathname === '/v1/compliance/scan' && route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            score: 42,
            riskLevel: 'high',
            violations: [
              { rule: 'Phone Number', severity: 'medium', category: 'pii', matchedText: '555-555-5555' },
            ],
          }),
        });
        return;
      }

      await route.continue();
    });
  });

  test('compliance page shows summary and table', async ({ page }) => {
    await page.goto('/compliance');
    await expect(page.getByRole('heading', { name: 'Compliance' })).toBeVisible();
    await expect(page.getByText('Total Scans')).toBeVisible();
    await expect(page.getByText('Low Risk')).toBeVisible();
    await expect(page.getByText('High Risk')).toBeVisible();
    await expect(page.getByText('Critical Risk')).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Prompt' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Version' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Score' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Risk' })).toBeVisible();
  });

  test('compliance scan form submits and shows results', async ({ page }) => {
    await page.goto('/compliance');

    await page.getByLabel('Prompt Name').fill('test-prompt');
    await page.getByLabel('Version Tag').fill('v1.0.0');
    await page.getByLabel('Text to Scan').fill('Call me at 555-555-5555');

    await page.getByRole('button', { name: /Scan/i }).click();

    await expect(page.getByText('Score: 42')).toBeVisible();
    await expect(page.getByText('Phone Number')).toBeVisible();
    await expect(page.getByText('555-555-5555')).toBeVisible();
  });

  test('compliance table supports search', async ({ page }) => {
    await page.goto('/compliance');
    await expect(page.getByText('customer-support')).toBeVisible();
    await expect(page.getByText('billing-bot')).toBeVisible();

    const search = page.getByLabel('Search compliance scores');
    await search.fill('billing');
    await expect(page.getByText('billing-bot')).toBeVisible();
    await expect(page.getByText('customer-support')).not.toBeVisible();
  });

  test('compliance detail dialog opens on row click', async ({ page }) => {
    await page.goto('/compliance');
    await page.getByRole('button', { name: /View details for billing-bot/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Compliance Details')).toBeVisible();
    await expect(page.getByText('billing-bot')).toBeVisible();
    await expect(page.getByText('Credit Card Number')).toBeVisible();
    await expect(page.getByText('4111-1111-1111-1111')).toBeVisible();
  });
});

test.describe('Compliance Review Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pm-api-key', 'pm_test_key_123');
      localStorage.setItem('pm-workspace', 'default');
    });

    await page.route('**/v1/compliance**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/v1/compliance/scores' && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 3,
                prompt_name: 'hr-assistant',
                version_tag: 'v2.0.0',
                score: 25,
                risk_level: 'critical',
                violations: [
                  { rule: 'Email Address', severity: 'medium', category: 'pii', matchedText: 'user@example.com' },
                ],
                created_at: 1714600000,
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
        return;
      }
      await route.continue();
    });
  });

  test('review page shows prompts sorted by risk', async ({ page }) => {
    await page.goto('/compliance/review');
    await expect(page.getByRole('heading', { name: /Review Prompts/i })).toBeVisible();
    await expect(page.getByText('hr-assistant')).toBeVisible();
    await expect(page.getByText('billing-bot')).toBeVisible();
  });
});
