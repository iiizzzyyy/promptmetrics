import { test, expect } from '@playwright/test';

test.describe('Dashboard Overview', () => {
  test('homepage shows dashboard title and summary cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Total Runs')).toBeVisible();
    await expect(page.getByText('Total Traces')).toBeVisible();
    await expect(page.getByText('Active Prompts')).toBeVisible();
    await expect(page.getByText('Total Logs')).toBeVisible();
  });

  test('window toggle switches between 7d, 30d, 90d', async ({ page }) => {
    await page.goto('/');
    const tab7 = page.locator('button', { hasText: '7 days' });
    const tab30 = page.locator('button', { hasText: '30 days' });
    const tab90 = page.locator('button', { hasText: '90 days' });

    await expect(tab7).toBeVisible();
    await expect(tab30).toBeVisible();
    await expect(tab90).toBeVisible();

    await tab30.click();
    await expect(tab30).toHaveClass(/bg-background/);

    await tab90.click();
    await expect(tab90).toHaveClass(/bg-background/);

    await tab7.click();
    await expect(tab7).toHaveClass(/bg-background/);
  });

  test('Cost & Latency chart card is rendered', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Cost & Latency')).toBeVisible();
  });

  test('Top Prompts and Evaluation Trends cards are rendered', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Top Prompts by Token Usage')).toBeVisible();
    await expect(page.getByText('Evaluation Trends')).toBeVisible();
  });

  test('Recent Runs table is rendered with headers', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Recent Runs')).toBeVisible();
    // Wait for the actual table to render (positive assertion instead of detached skeleton wait)
    await expect(page.locator('th:has-text("Run ID")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('th:has-text("Workflow")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });
});

test.describe('Prompts Pages', () => {
  test('prompts list page shows table with headers', async ({ page }) => {
    await page.goto('/prompts');
    await expect(page.getByRole('heading', { name: 'Prompts' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Driver' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created At' })).toBeVisible();
  });

  test('prompts list links navigate to detail page', async ({ page }) => {
    await page.goto('/prompts');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const firstLink = page.locator('table tbody tr:first-child td a').first();
    if (await firstLink.count() === 0) {
      test.skip(true, 'No prompts in table');
      return;
    }
    const promptName = await firstLink.textContent();
    if (promptName) {
      await firstLink.click();
      await expect(page).toHaveURL(/.*\/prompts\/.+/);
      await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    }
  });

  test('prompt detail page shows version info card', async ({ page }) => {
    await page.goto('/prompts');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const firstLink = page.locator('table tbody tr:first-child td a').first();
    if (await firstLink.count() === 0) {
      test.skip(true, 'No prompts in table');
      return;
    }
    await firstLink.click();
    await expect(page.getByText('Version Info')).toBeVisible();
    await expect(page.getByText('Version Tag')).toBeVisible();
    await expect(page.getByText('Driver')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
  });
});

test.describe('Logs Page', () => {
  test('logs page shows execution logs table', async ({ page }) => {
    await page.goto('/logs');
    await expect(page.getByRole('heading', { name: 'Execution Logs' })).toBeVisible();
    await expect(page.locator('th:has-text("Prompt Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Model")')).toBeVisible();
    await expect(page.locator('th:has-text("Tokens In")')).toBeVisible();
    await expect(page.locator('th:has-text("Cost")')).toBeVisible();
  });
});

test.describe('Traces Pages', () => {
  test('traces list page shows table', async ({ page }) => {
    await page.goto('/traces');
    await expect(page.getByRole('heading', { name: 'Traces' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Trace ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Prompt' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Version' })).toBeVisible();
  });

  test('trace detail page shows span tree', async ({ page }) => {
    await page.goto('/traces');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const firstLink = page.locator('table tbody tr:first-child td a').first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await expect(page).toHaveURL(/.*\/traces\/.+/);
      await expect(page.getByText('Spans')).toBeVisible();
    }
  });
});

test.describe('Runs Page', () => {
  test('runs page shows table with status filter', async ({ page }) => {
    await page.goto('/runs');
    await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
    await expect(page.locator('th:has-text("Workflow Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Created At")')).toBeVisible();
    await expect(page.locator('th:has-text("Duration")')).toBeVisible();
  });
});

test.describe('Evaluations Page', () => {
  test('evaluations page shows list', async ({ page }) => {
    await page.goto('/evaluations');
    await expect(page.getByRole('heading', { name: 'Evaluations' })).toBeVisible();
  });
});

test.describe('Labels Page', () => {
  test('labels page shows label management', async ({ page }) => {
    await page.goto('/labels');
    await expect(page.getByRole('heading', { name: 'Labels' })).toBeVisible();
  });
});

test.describe('Settings Page', () => {
  test('settings page allows API key input', async ({ page }) => {
    await page.goto('/settings');
    const input = page.getByPlaceholder('Enter your API key');
    await expect(input).toBeVisible();
    await input.fill('pm_test_key_123');
    await expect(input).toHaveValue('pm_test_key_123');
  });

  test('settings page shows workspace input', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByLabel('Workspace')).toBeVisible();
  });
});

test.describe('Sidebar Navigation', () => {
  test('all sidebar links navigate correctly', async ({ page }) => {
    await page.goto('/');

    const links = [
      { name: 'Dashboard', url: '/', heading: 'Dashboard' },
      { name: 'Prompts', url: '/prompts', heading: 'Prompts' },
      { name: 'Logs', url: '/logs', heading: 'Execution Logs' },
      { name: 'Traces', url: '/traces', heading: 'Traces' },
      { name: 'Runs', url: '/runs', heading: 'Runs' },
      { name: 'Evaluations', url: '/evaluations', heading: 'Evaluations' },
      { name: 'Labels', url: '/labels', heading: 'Labels' },
      { name: 'Settings', url: '/settings', heading: 'Settings' },
    ];

    for (const link of links) {
      await page.getByRole('link', { name: link.name, exact: true }).click();
      await page.waitForURL(`http://localhost:3001${link.url}`);
      await expect(page.locator('h1', { hasText: link.heading })).toBeVisible();
    }
  });
});

test.describe('Responsive Layout', () => {
  test('mobile hamburger menu toggles sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const hamburger = page.locator('button').first();
    await hamburger.click();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });
});
