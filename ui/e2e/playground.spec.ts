import { test, expect } from '@playwright/test';

test.describe('Playground Page', () => {
  test.beforeEach(async ({ page }) => {
    // Seed localStorage so the API client sends an API key
    await page.addInitScript(() => {
      localStorage.setItem('pm-api-key', 'pm_test_key_123');
      localStorage.setItem('pm-workspace', 'default');
    });
  });

  test('playground page renders with header, editor, and output panes', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.getByText('Playground')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Editor/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Variables/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Config/i })).toBeVisible();
    await expect(page.getByText('Output', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run/i })).toBeVisible();
  });

  test('model selector opens and shows providers and models', async ({ page }) => {
    await page.goto('/playground');

    // Intercept models API so we don't need real provider env vars
    await page.route('**/v1/playground/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', slug: 'gpt-4o' },
            { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', slug: 'gpt-4o-mini' },
            { id: 'claude-sonnet', provider: 'anthropic', name: 'Claude 3.5 Sonnet', slug: 'claude-3-5-sonnet-20241022' },
          ],
          total: 3,
          page: 1,
          limit: 50,
          totalPages: 1,
        }),
      });
    });

    const modelTrigger = page.locator('[aria-label="Select model"]').first();
    await expect(modelTrigger).toBeVisible();
    await modelTrigger.click();

    const listbox = page.getByRole('listbox');
    await expect(listbox.getByText('openai')).toBeVisible();
    await expect(listbox.getByText('anthropic')).toBeVisible();
    await expect(listbox.getByText('GPT-4o', { exact: true })).toBeVisible();
    await expect(listbox.getByText('Claude 3.5 Sonnet')).toBeVisible();
  });

  test('run button triggers streaming output and metrics appear', async ({ page }) => {
    await page.goto('/playground');

    await page.route('**/v1/playground/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', slug: 'gpt-4o' },
          ],
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        }),
      });
    });

    await page.route('**/v1/playground/chat/stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: [
          JSON.stringify({ type: 'token', content: 'Hello' }),
          JSON.stringify({ type: 'token', content: ' world' }),
          JSON.stringify({ type: 'metrics', tokensIn: 10, tokensOut: 2, latencyMs: 120, costUsd: 0.0001 }),
          JSON.stringify({ type: 'done', finishReason: 'stop' }),
        ].join('\n'),
      });
    });

    const runButton = page.getByRole('button', { name: /Run/i });
    await runButton.click();

    await expect(page.getByText('Hello world')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tokens In: 10')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tokens Out: 2')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Latency: 120ms')).toBeVisible({ timeout: 10000 });
  });

  test('cancel button aborts the stream', async ({ page }) => {
    await page.goto('/playground');

    await page.route('**/v1/playground/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', slug: 'gpt-4o' },
          ],
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        }),
      });
    });

    let requestAborted = false;
    await page.route('**/v1/playground/chat/stream', async (route) => {
      const request = route.request();
      if (request.failure()?.errorText?.includes('aborted')) {
        requestAborted = true;
      }
      // Intentionally delay so the cancel button is visible
      await new Promise((r) => setTimeout(r, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: JSON.stringify({ type: 'token', content: 'slow' }),
      });
    });

    const runButton = page.getByRole('button', { name: /Run/i });
    await runButton.click();

    // Cancel button should appear while running
    const cancelButton = page.getByRole('button', { name: /Cancel/i });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // After cancel, the running indicator should disappear
    await expect(cancelButton).not.toBeVisible({ timeout: 5000 });

    // Assert that the request was actually aborted
    expect(requestAborted).toBe(true);
  });

  test('copy and clear buttons work', async ({ page }) => {
    await page.goto('/playground');

    await page.route('**/v1/playground/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', slug: 'gpt-4o' },
          ],
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        }),
      });
    });

    await page.route('**/v1/playground/chat/stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: [
          JSON.stringify({ type: 'token', content: 'Copy me' }),
          JSON.stringify({ type: 'metrics', tokensIn: 5, tokensOut: 1, latencyMs: 50, costUsd: 0.00005 }),
          JSON.stringify({ type: 'done', finishReason: 'stop' }),
        ].join('\n'),
      });
    });

    const runButton = page.getByRole('button', { name: /Run/i });
    await runButton.click();

    await expect(page.getByText('Copy me')).toBeVisible({ timeout: 10000 });

    // Copy button
    const copyButton = page.getByRole('button', { name: /Copy output/i });
    await copyButton.click();

    // Clear button
    const clearButton = page.getByRole('button', { name: /Clear output/i });
    await clearButton.click();

    await expect(page.getByText('Copy me')).not.toBeVisible();
    await expect(page.getByText('Click Run to generate output...')).toBeVisible();
  });

  test('error state renders on stream error', async ({ page }) => {
    await page.goto('/playground');

    await page.route('**/v1/playground/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', slug: 'gpt-4o' },
          ],
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        }),
      });
    });

    await page.route('**/v1/playground/chat/stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: JSON.stringify({ type: 'error', message: 'Provider rate limit exceeded', code: 'rate_limit' }),
      });
    });

    const runButton = page.getByRole('button', { name: /Run/i });
    await runButton.click();

    await expect(page.getByText('Provider rate limit exceeded')).toBeVisible({ timeout: 10000 });
  });
});
