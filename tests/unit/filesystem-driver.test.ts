import fs from 'fs';
import path from 'path';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';
import { PromptFile } from '@drivers/promptmetrics-driver.interface';

describe('FilesystemDriver', () => {
  const testBasePath = path.resolve(__dirname, '../../data/test-prompts');
  let driver: FilesystemDriver;

  beforeEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true });
    }
    driver = new FilesystemDriver(testBasePath);
  });

  afterEach(() => {
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true });
    }
  });

  const samplePrompt: PromptFile = {
    name: 'welcome',
    version: '1.0.0',
    template: 'Hello {{name}}!',
    variables: {
      name: { type: 'string', required: true },
    },
  };

  it('should create a prompt and write to disk', async () => {
    const result = await driver.createPrompt(samplePrompt);
    expect(result.name).toBe('welcome');
    expect(result.version_tag).toBe('1.0.0');
    expect(fs.existsSync(path.join(testBasePath, 'welcome', '1.0.0.json'))).toBe(true);
  });

  it('should get a prompt by version', async () => {
    await driver.createPrompt(samplePrompt);
    const result = await driver.getPrompt('welcome', '1.0.0');
    expect(result).toBeDefined();
    expect(result!.content.template).toBe('Hello {{name}}!');
    expect(result!.version.version_tag).toBe('1.0.0');
  });

  it('should get latest version when version is omitted', async () => {
    await driver.createPrompt(samplePrompt);
    await driver.createPrompt({ ...samplePrompt, version: '1.1.0', template: 'Hi {{name}}!' });
    const result = await driver.getPrompt('welcome');
    expect(result).toBeDefined();
    expect(result!.content.version).toBe('1.1.0');
    expect(result!.content.template).toBe('Hi {{name}}!');
  });

  it('should return undefined for non-existent prompt', async () => {
    const result = await driver.getPrompt('non-existent');
    expect(result).toBeUndefined();
  });

  it('should list prompts with pagination', async () => {
    await driver.createPrompt({ ...samplePrompt, name: 'prompt-a' });
    await driver.createPrompt({ ...samplePrompt, name: 'prompt-b' });
    await driver.createPrompt({ ...samplePrompt, name: 'prompt-c' });

    const result = await driver.listPrompts(1, 2);
    expect(result.items.length).toBe(2);
    expect(result.total).toBe(3);
  });

  it('should list versions', async () => {
    await driver.createPrompt(samplePrompt);
    await driver.createPrompt({ ...samplePrompt, version: '1.1.0' });

    const result = await driver.listVersions('welcome');
    expect(result.items.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.items[0].version_tag).toBe('1.0.0');
    expect(result.items[1].version_tag).toBe('1.1.0');
  });

  it('should search prompts', async () => {
    await driver.createPrompt({ ...samplePrompt, name: 'user-onboarding' });
    await driver.createPrompt({ ...samplePrompt, name: 'admin-dashboard' });
    await driver.createPrompt({ ...samplePrompt, name: 'onboarding-v2' });

    const result = await driver.search('onboarding');
    expect(result.length).toBe(2);
    expect(result).toContain('user-onboarding');
    expect(result).toContain('onboarding-v2');
  });
});
