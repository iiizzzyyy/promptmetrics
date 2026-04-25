import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test('homepage shows dashboard title', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'PromptMetrics Dashboard' })).toBeVisible();
  });

  test('sidebar navigation links work', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Prompts' }).click();
    await expect(page).toHaveURL(/.*\/prompts/);
    await expect(page.getByRole('heading', { name: 'Prompts' })).toBeVisible();

    await page.getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/.*\/logs/);
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible();

    await page.getByRole('link', { name: 'Traces' }).click();
    await expect(page).toHaveURL(/.*\/traces/);
    await expect(page.getByRole('heading', { name: 'Traces' })).toBeVisible();

    await page.getByRole('link', { name: 'Runs' }).click();
    await expect(page).toHaveURL(/.*\/runs/);
    await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();

    await page.getByRole('link', { name: 'Labels' }).click();
    await expect(page).toHaveURL(/.*\/labels/);
    await expect(page.getByRole('heading', { name: 'Labels' })).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/.*\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('settings page allows API key input', async ({ page }) => {
    await page.goto('/settings');
    const input = page.getByPlaceholder('Enter X-API-Key');
    await expect(input).toBeVisible();
    await input.fill('pm_test_key_123');
    await expect(input).toHaveValue('pm_test_key_123');
  });
});
