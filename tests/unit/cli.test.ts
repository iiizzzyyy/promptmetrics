import axios from 'axios';
import fs from 'fs';
import yaml from 'js-yaml';

jest.mock('axios');
jest.mock('fs');
jest.mock('js-yaml');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedYaml = yaml as jest.Mocked<typeof yaml>;

describe('CLI', () => {
  let originalArgv: string[];
  let logs: string[];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalExit: typeof process.exit;

  function runCli(args: string[]): Promise<void> {
    return new Promise((resolve) => {
      process.argv = ['node', 'dist/cli/promptmetrics-cli.js', ...args];
      jest.isolateModules(() => {
        require('../../src/cli/promptmetrics-cli');
      });
      // Allow async actions to settle
      setTimeout(resolve, 50);
    });
  }

  beforeEach(() => {
    originalArgv = process.argv;
    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;

    logs = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
    console.error = () => {
      /* swallow */
    };
    process.exit = (() => {
      /* swallow */
    }) as typeof process.exit;

    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('not found');
    });
    mockedYaml.load.mockReturnValue({});

    mockedAxios.post.mockResolvedValue({ data: { id: 1, status: 'ok' } } as never);
    mockedAxios.get.mockResolvedValue({ data: { items: [{ name: 'welcome' }] } } as never);
    mockedAxios.patch.mockResolvedValue({ data: { status: 'updated' } } as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
    jest.resetAllMocks();
  });

  it('init creates promptmetrics.yaml', async () => {
    mockedFs.existsSync.mockImplementation((p) => String(p).includes('promptmetrics.yaml') === false);
    mockedFs.writeFileSync.mockImplementation(() => {});

    await runCli(['init']);

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('promptmetrics.yaml'),
      expect.stringContaining('server: http://localhost:3000'),
    );
    expect(logs).toContain('Created promptmetrics.yaml');
  });

  it('create-prompt posts to /v1/prompts', async () => {
    mockedFs.readFileSync.mockImplementation((p) => {
      if (String(p).includes('welcome.json')) return JSON.stringify({ name: 'welcome' });
      throw new Error('not found');
    });

    await runCli(['create-prompt', '--file', 'welcome.json', '--api-key', 'pm_test']);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/v1/prompts',
      { name: 'welcome' },
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'pm_test' }),
      }),
    );
  });

  it('list-prompts fetches with pagination', async () => {
    await runCli(['list-prompts', '--page', '2', '--limit', '10', '--api-key', 'pm_test']);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:3000/v1/prompts?page=2&limit=10',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'pm_test' }),
      }),
    );
  });

  it('get-prompt fetches by name with variables', async () => {
    await runCli([
      'get-prompt',
      'welcome',
      '--version',
      '1.0.0',
      '--var',
      'name=Alice',
      '--api-key',
      'pm_test',
    ]);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:3000/v1/prompts/welcome?version=1.0.0&variables%5Bname%5D=Alice',
      expect.anything(),
    );
  });

  it('import posts JSON files from directory', async () => {
    const mockDirent = (name: string, isDir: boolean) =>
      ({ name, isFile: () => !isDir, isDirectory: () => isDir }) as fs.Dirent;
    mockedFs.readdirSync.mockReturnValue([mockDirent('a.json', false), mockDirent('b.txt', false)] as never);
    mockedFs.readFileSync.mockImplementation((p) => {
      if (String(p).includes('a.json')) return JSON.stringify({ name: 'a' });
      throw new Error('not found');
    });

    await runCli(['import', '--dir', './prompts', '--api-key', 'pm_test']);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/v1/prompts',
      { name: 'a' },
      expect.anything(),
    );
  });

  it('export fetches prompts with limit', async () => {
    mockedFs.mkdirSync.mockImplementation(() => undefined as unknown as string);
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/v1/prompts?')) {
        return Promise.resolve({ data: { items: [{ name: 'welcome' }] } } as never);
      }
      if (url.includes('/v1/prompts/welcome')) {
        return Promise.resolve({ data: { content: { name: 'welcome' } } } as never);
      }
      return Promise.resolve({ data: {} } as never);
    });

    await runCli(['export', '--out', './backup', '--limit', '5', '--api-key', 'pm_test']);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:3000/v1/prompts?limit=5',
      expect.anything(),
    );
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it('log posts metadata to /v1/logs', async () => {
    await runCli([
      'log',
      '--prompt-name',
      'welcome',
      '--version',
      '1.0.0',
      '--provider',
      'openai',
      '--model',
      'gpt-4o',
      '--tokens-in',
      '10',
      '--tokens-out',
      '20',
      '--latency-ms',
      '500',
      '--cost-usd',
      '0.001',
      '--metadata',
      'experiment=headline-v2',
      '--api-key',
      'pm_test',
    ]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/v1/logs',
      expect.objectContaining({
        prompt_name: 'welcome',
        version_tag: '1.0.0',
        provider: 'openai',
        model: 'gpt-4o',
        tokens_in: 10,
        tokens_out: 20,
        latency_ms: 500,
        cost_usd: 0.001,
        metadata: { experiment: 'headline-v2' },
      }),
      expect.anything(),
    );
  });

  it('create-trace posts to /v1/traces', async () => {
    await runCli(['create-trace', '--prompt-name', 'welcome', '--api-key', 'pm_test']);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/v1/traces',
      expect.objectContaining({ prompt_name: 'welcome' }),
      expect.anything(),
    );
  });

  it('get-trace fetches by ID', async () => {
    await runCli(['get-trace', 'trace-123', '--api-key', 'pm_test']);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:3000/v1/traces/trace-123',
      expect.anything(),
    );
  });

  it('add-span posts to trace spans endpoint', async () => {
    await runCli([
      'add-span',
      'trace-123',
      '--name',
      'fetch-prompt',
      '--status',
      'ok',
      '--start-time',
      '1000',
      '--end-time',
      '2000',
      '--api-key',
      'pm_test',
    ]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/v1/traces/trace-123/spans',
      expect.objectContaining({
        name: 'fetch-prompt',
        status: 'ok',
        start_time: 1000,
        end_time: 2000,
      }),
      expect.anything(),
    );
  });

  it('create-run posts to /v1/runs', async () => {
    await runCli([
      'create-run',
      '--workflow',
      'headline-agent',
      '--input',
      'topic=AI',
      '--output',
      'headline=Test',
      '--api-key',
      'pm_test',
    ]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/v1/runs',
      expect.objectContaining({
        workflow_name: 'headline-agent',
        input: { topic: 'AI' },
        output: { headline: 'Test' },
      }),
      expect.anything(),
    );
  });

  it('update-run patches to /v1/runs/:id', async () => {
    await runCli([
      'update-run',
      'run-123',
      '--status',
      'completed',
      '--output',
      'result=done',
      '--api-key',
      'pm_test',
    ]);

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/runs/run-123',
      expect.objectContaining({ status: 'completed', output: { result: 'done' } }),
      expect.anything(),
    );
  });

  it('add-label posts to prompt labels endpoint', async () => {
    await runCli([
      'add-label',
      'welcome',
      'production',
      '--version',
      '1.0.0',
      '--api-key',
      'pm_test',
    ]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/v1/prompts/welcome/labels',
      { name: 'production', version_tag: '1.0.0' },
      expect.anything(),
    );
  });

  it('get-label fetches prompt label', async () => {
    await runCli(['get-label', 'welcome', 'production', '--api-key', 'pm_test']);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:3000/v1/prompts/welcome/labels/production',
      expect.anything(),
    );
  });

  it('reads server and api_key from promptmetrics.yaml', async () => {
    mockedFs.existsSync.mockImplementation((p) => String(p).includes('promptmetrics.yaml'));
    mockedFs.readFileSync.mockImplementation((p) => {
      if (String(p).includes('promptmetrics.yaml')) return 'server: http://custom:8080\napi_key: pm_from_yaml';
      throw new Error('not found');
    });
    mockedYaml.load.mockReturnValue({ server: 'http://custom:8080', api_key: 'pm_from_yaml' });

    await runCli(['list-prompts']);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://custom:8080/v1/prompts?page=1&limit=50',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'pm_from_yaml' }),
      }),
    );
  });
});
