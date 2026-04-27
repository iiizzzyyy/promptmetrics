import nock from 'nock';
import { GithubDriver } from '@drivers/promptmetrics-github-driver';
import { PromptFile } from '@drivers/promptmetrics-driver.interface';

describe('GithubDriver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      DRIVER: 'github',
      GITHUB_REPO: 'test-org/test-repo',
      GITHUB_TOKEN: 'test-token',
      API_KEY_SALT: 'test-salt-for-ci',
    };
    nock.cleanAll();
  });

  afterAll(() => {
    process.env = originalEnv;
    nock.cleanAll();
  });

  const samplePrompt: PromptFile = {
    name: 'welcome',
    version: '1.0.0',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello {{name}}!' },
    ],
    variables: {
      name: { type: 'string', required: true },
    },
  };

  it('should throw if GITHUB_REPO or GITHUB_TOKEN is missing', () => {
    process.env.GITHUB_REPO = '';
    expect(() => {
      jest.isolateModules(() => {
        const { GithubDriver } = require('@drivers/promptmetrics-github-driver');
        new GithubDriver();
      });
    }).toThrow('GITHUB_REPO and GITHUB_TOKEN are required');
  });

  it('should create prompt via GitHub API with retry on rate limit', async () => {
    process.env.DRIVER = 'github';
    process.env.GITHUB_REPO = 'test-org/test-repo';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.API_KEY_SALT = 'test-salt-for-ci';

    let driver: GithubDriver;
    jest.isolateModules(() => {
      const { GithubDriver: GH } = require('@drivers/promptmetrics-github-driver');
      driver = new GH();
    });

    // Mock file check (file doesn't exist)
    nock('https://api.github.com')
      .get('/repos/test-org/test-repo/contents/prompts/welcome/1.0.0.json')
      .reply(404, { message: 'Not Found' });

    // Mock create file
    nock('https://api.github.com')
      .put('/repos/test-org/test-repo/contents/prompts/welcome/1.0.0.json')
      .reply(201, { content: { sha: 'abc123' } });

    // Mock create tag
    nock('https://api.github.com')
      .post('/repos/test-org/test-repo/git/refs')
      .reply(201, { ref: 'refs/tags/prompt-welcome-v1.0.0' });

    // Mock get latest sha
    nock('https://api.github.com')
      .get('/repos/test-org/test-repo/git/refs/heads/main')
      .reply(200, { object: { sha: 'def456' } });

    const result = await driver!.createPrompt(samplePrompt);
    expect(result.name).toBe('welcome');
    expect(result.version_tag).toBe('1.0.0');
  });

  it('should retry on rate limit (429)', async () => {
    process.env.DRIVER = 'github';
    process.env.GITHUB_REPO = 'test-org/test-repo';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.API_KEY_SALT = 'test-salt-for-ci';

    let driver: GithubDriver;
    jest.isolateModules(() => {
      const { GithubDriver: GH } = require('@drivers/promptmetrics-github-driver');
      driver = new GH();
    });

    // Mock file check
    nock('https://api.github.com')
      .get('/repos/test-org/test-repo/contents/prompts/welcome/1.0.0.json')
      .reply(404, { message: 'Not Found' });

    // First attempt: rate limited
    nock('https://api.github.com')
      .put('/repos/test-org/test-repo/contents/prompts/welcome/1.0.0.json')
      .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });

    // Second attempt: success
    nock('https://api.github.com')
      .put('/repos/test-org/test-repo/contents/prompts/welcome/1.0.0.json')
      .reply(201, { content: { sha: 'abc123' } });

    // Mock create tag
    nock('https://api.github.com')
      .post('/repos/test-org/test-repo/git/refs')
      .reply(201, { ref: 'refs/tags/prompt-welcome-v1.0.0' });

    // Mock get latest sha
    nock('https://api.github.com')
      .get('/repos/test-org/test-repo/git/refs/heads/main')
      .reply(200, { object: { sha: 'def456' } });

    const result = await driver!.createPrompt(samplePrompt);
    expect(result.name).toBe('welcome');
    expect(result.version_tag).toBe('1.0.0');
  });

  it('should reject path traversal in getPrompt', async () => {
    process.env.DRIVER = 'github';
    process.env.GITHUB_REPO = 'test-org/test-repo';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.API_KEY_SALT = 'test-salt-for-ci';

    let driver: GithubDriver;
    jest.isolateModules(() => {
      const { GithubDriver: GH } = require('@drivers/promptmetrics-github-driver');
      driver = new GH();
    });

    await expect(driver!.getPrompt('../../../etc/passwd')).rejects.toThrow('Invalid prompt name');
  });
});
