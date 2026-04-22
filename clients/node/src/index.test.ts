import { PromptMetrics } from './index';

describe('PromptMetrics Node Client', () => {
  it('should instantiate with config', () => {
    const client = new PromptMetrics({ baseUrl: 'http://localhost:3000', apiKey: 'pm_test' });
    expect(client).toBeInstanceOf(PromptMetrics);
    expect(client.prompts).toBeDefined();
    expect(client.logs).toBeDefined();
  });
});
