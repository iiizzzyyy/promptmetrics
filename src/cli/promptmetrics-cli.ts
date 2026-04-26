#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import yaml from 'js-yaml';

const program = new Command();

interface ConfigFile {
  server?: string;
  api_key?: string;
}

function loadConfig(): ConfigFile {
  try {
    const configPath = path.resolve('promptmetrics.yaml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return (yaml.load(content) as ConfigFile) || {};
    }
  } catch {
    // ignore config read errors
  }
  return {};
}

function getServer(): string {
  const opts = program.opts() as { server?: string };
  return opts.server || loadConfig().server || 'http://localhost:3000';
}

function getApiKey(): string | undefined {
  const opts = program.opts() as { apiKey?: string };
  return opts.apiKey || loadConfig().api_key;
}

function print(data: unknown): void {
  const opts = program.opts() as { json?: boolean };
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (Array.isArray(data)) {
    console.table(data);
    return;
  }
  console.log(data);
}

function getHeaders(): Record<string, string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Error: API key is required. Run `promptmetrics init` to create a config file or pass `--api-key`.');
    process.exit(1);
  }
  return { 'Content-Type': 'application/json', 'X-API-Key': apiKey };
}

function handleCliError(err: unknown): void {
  const axiosErr = err as {
    response?: { status?: number; data?: { error?: string; message?: string } };
    code?: string;
    message?: string;
  };
  if (axiosErr.response) {
    const status = axiosErr.response.status;
    const msg = axiosErr.response.data?.error || axiosErr.response.data?.message || 'Request failed';
    console.error(`Error: ${msg} (${status})`);
  } else if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT') {
    console.error('Error: Server unreachable. Is PromptMetrics running?');
  } else {
    console.error('Error:', axiosErr.message || 'Unknown error');
  }
  process.exit(1);
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function parseMetadata(pairs: string[]): Record<string, string | number | boolean> {
  const metadata: Record<string, string | number | boolean> = {};
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) {
      console.error(`Invalid metadata format: ${pair}. Expected key=value`);
      process.exit(1);
    }
    const key = pair.slice(0, idx);
    let val: string | number | boolean = pair.slice(idx + 1);
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (!isNaN(Number(val)) && val !== '') val = Number(val);
    metadata[key] = val;
  }
  return metadata;
}

function parseVariables(pairs: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) {
      console.error(`Invalid variable format: ${pair}. Expected key=value`);
      process.exit(1);
    }
    vars[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return vars;
}

function parseInputOutput(pairs: string[]): Record<string, string | number | boolean> {
  return parseMetadata(pairs);
}

program.name('promptmetrics').description('PromptMetrics CLI');

program.option('--server <url>', 'Server URL');
program.option('--api-key <key>', 'API key');
program.option('--json', 'Output as JSON');

program
  .command('init')
  .description('Create a promptmetrics.yaml config file')
  .action(() => {
    const configPath = path.resolve('promptmetrics.yaml');
    if (fs.existsSync(configPath)) {
      console.log('promptmetrics.yaml already exists.');
      return;
    }
    const content = `server: http://localhost:3000\napi_key: your-api-key-here\n`;
    fs.writeFileSync(configPath, content);
    console.log('Created promptmetrics.yaml');
  });

program
  .command('create-prompt')
  .description('Create a new prompt from a JSON or YAML file')
  .requiredOption('--file <path>', 'Path to prompt JSON/YAML file')
  .action(async (options) => {
    try {
      const raw = fs.readFileSync(options.file, 'utf-8');
      const content =
        options.file.endsWith('.yaml') || options.file.endsWith('.yml') ? (yaml.load(raw) as object) : JSON.parse(raw);
      const res = await axios.post(`${getServer()}/v1/prompts`, content, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('list-prompts')
  .description('List all prompts')
  .option('--page <n>', 'Page number', '1')
  .option('--limit <n>', 'Items per page', '50')
  .action(async (options) => {
    try {
      const res = await axios.get(`${getServer()}/v1/prompts?page=${options.page}&limit=${options.limit}`, {
        headers: getHeaders(),
      });
      print((res.data as { items: unknown[] }).items);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('get-prompt <name>')
  .description('Get a prompt by name')
  .option('--version <version>', 'Prompt version')
  .option('--var <pair>', 'Template variable key=value (repeatable)', collect, [])
  .action(async (name, options) => {
    try {
      const vars = parseVariables(options.var);
      const params = new URLSearchParams();
      if (options.version) params.set('version', options.version);
      for (const [key, value] of Object.entries(vars)) {
        params.set(`variables[${key}]`, value);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await axios.get(`${getServer()}/v1/prompts/${encodeURIComponent(name)}${qs}`, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('import')
  .description('Import prompts from a directory of JSON files')
  .requiredOption('--dir <path>', 'Directory containing prompt JSON files')
  .action(async (options) => {
    function collectJsonFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collectJsonFiles(fullPath));
        } else if (entry.name.endsWith('.json')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = collectJsonFiles(options.dir);
    const results = [];
    for (const filePath of files) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const relativeFile = path.relative(options.dir, filePath);
      try {
        const res = await axios.post(`${getServer()}/v1/prompts`, content, {
          headers: getHeaders(),
        });
        results.push({ file: relativeFile, status: 'created', name: (res.data as { name: string }).name });
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
        results.push({
          file: relativeFile,
          status: 'error',
          message: axiosErr.response?.data?.error || axiosErr.message || 'Unknown error',
        });
      }
    }
    print(results);
  });

program
  .command('export')
  .description('Export all prompts to a directory')
  .requiredOption('--out <path>', 'Output directory')
  .option('--limit <n>', 'Max prompts to export', '1000')
  .action(async (options) => {
    try {
      const res = await axios.get(`${getServer()}/v1/prompts?limit=${options.limit}`, {
        headers: getHeaders(),
      });
      const prompts = (res.data as { items: { name: string }[] }).items;

      if (!fs.existsSync(options.out)) {
        fs.mkdirSync(options.out, { recursive: true });
      }

      for (const prompt of prompts) {
        const detailRes = await axios.get(`${getServer()}/v1/prompts/${encodeURIComponent(prompt.name)}`, {
          headers: getHeaders(),
        });
        const content = (detailRes.data as { content: unknown }).content;
        fs.writeFileSync(path.join(options.out, `${prompt.name}.json`), JSON.stringify(content, null, 2));
      }

      print({ exported: prompts.length, directory: options.out });
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('log')
  .description('Log metadata about an LLM call')
  .requiredOption('--prompt-name <name>', 'Prompt name')
  .requiredOption('--version <version>', 'Version tag')
  .option('--provider <provider>', 'LLM provider')
  .option('--model <model>', 'Model name')
  .option('--tokens-in <n>', 'Input tokens')
  .option('--tokens-out <n>', 'Output tokens')
  .option('--latency-ms <n>', 'Latency in milliseconds')
  .option('--cost-usd <n>', 'Cost in USD')
  .option('--metadata <pair>', 'Metadata key=value (repeatable)', collect, [])
  .action(async (options) => {
    try {
      const payload: Record<string, unknown> = {
        prompt_name: options.promptName,
        version_tag: options.version,
      };
      if (options.provider) payload.provider = options.provider;
      if (options.model) payload.model = options.model;
      if (options.tokensIn !== undefined) payload.tokens_in = parseInt(options.tokensIn, 10);
      if (options.tokensOut !== undefined) payload.tokens_out = parseInt(options.tokensOut, 10);
      if (options.latencyMs !== undefined) payload.latency_ms = parseInt(options.latencyMs, 10);
      if (options.costUsd !== undefined) payload.cost_usd = parseFloat(options.costUsd);
      if (options.metadata.length) payload.metadata = parseMetadata(options.metadata);
      const res = await axios.post(`${getServer()}/v1/logs`, payload, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('create-trace')
  .description('Create a new trace')
  .option('--prompt-name <name>', 'Prompt name')
  .option('--version <version>', 'Version tag')
  .option('--metadata <pair>', 'Metadata key=value (repeatable)', collect, [])
  .action(async (options) => {
    try {
      const payload: Record<string, unknown> = {};
      if (options.promptName) payload.prompt_name = options.promptName;
      if (options.version) payload.version_tag = options.version;
      if (options.metadata.length) payload.metadata = parseMetadata(options.metadata);
      const res = await axios.post(`${getServer()}/v1/traces`, payload, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('get-trace <trace_id>')
  .description('Get a trace by ID')
  .action(async (traceId) => {
    try {
      const res = await axios.get(`${getServer()}/v1/traces/${encodeURIComponent(traceId)}`, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('add-span <trace_id>')
  .description('Add a span to a trace')
  .requiredOption('--name <name>', 'Span name')
  .requiredOption('--status <status>', 'Span status (ok|error)')
  .option('--parent-id <id>', 'Parent span ID')
  .option('--start-time <ms>', 'Start time in ms')
  .option('--end-time <ms>', 'End time in ms')
  .option('--metadata <pair>', 'Metadata key=value (repeatable)', collect, [])
  .action(async (traceId, options) => {
    try {
      const payload: Record<string, unknown> = {
        name: options.name,
        status: options.status,
      };
      if (options.parentId) payload.parent_id = options.parentId;
      if (options.startTime !== undefined) payload.start_time = parseInt(options.startTime, 10);
      if (options.endTime !== undefined) payload.end_time = parseInt(options.endTime, 10);
      if (options.metadata.length) payload.metadata = parseMetadata(options.metadata);
      const res = await axios.post(`${getServer()}/v1/traces/${encodeURIComponent(traceId)}/spans`, payload, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('create-run')
  .description('Create a new workflow run')
  .requiredOption('--workflow <name>', 'Workflow name')
  .option('--status <status>', 'Run status (running|completed|failed)', 'running')
  .option('--input <pair>', 'Input key=value (repeatable)', collect, [])
  .option('--output <pair>', 'Output key=value (repeatable)', collect, [])
  .option('--trace-id <id>', 'Associated trace ID')
  .option('--metadata <pair>', 'Metadata key=value (repeatable)', collect, [])
  .action(async (options) => {
    try {
      const payload: Record<string, unknown> = {
        workflow_name: options.workflow,
        status: options.status,
      };
      if (options.input.length) payload.input = parseInputOutput(options.input);
      if (options.output.length) payload.output = parseInputOutput(options.output);
      if (options.traceId) payload.trace_id = options.traceId;
      if (options.metadata.length) payload.metadata = parseMetadata(options.metadata);
      const res = await axios.post(`${getServer()}/v1/runs`, payload, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('update-run <run_id>')
  .description('Update a workflow run')
  .option('--status <status>', 'Run status (running|completed|failed)')
  .option('--output <pair>', 'Output key=value (repeatable)', collect, [])
  .option('--metadata <pair>', 'Metadata key=value (repeatable)', collect, [])
  .action(async (runId, options) => {
    try {
      const payload: Record<string, unknown> = {};
      if (options.status) payload.status = options.status;
      if (options.output.length) payload.output = parseInputOutput(options.output);
      if (options.metadata.length) payload.metadata = parseMetadata(options.metadata);
      const res = await axios.patch(`${getServer()}/v1/runs/${encodeURIComponent(runId)}`, payload, {
        headers: getHeaders(),
      });
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('add-label <prompt_name> <label_name>')
  .description('Add a label to a prompt version')
  .requiredOption('--version <version>', 'Version tag')
  .action(async (promptName, labelName, options) => {
    try {
      const res = await axios.post(
        `${getServer()}/v1/prompts/${encodeURIComponent(promptName)}/labels`,
        { name: labelName, version_tag: options.version },
        { headers: getHeaders() },
      );
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program
  .command('get-label <prompt_name> <label_name>')
  .description('Get a label for a prompt')
  .action(async (promptName, labelName) => {
    try {
      const res = await axios.get(
        `${getServer()}/v1/prompts/${encodeURIComponent(promptName)}/labels/${encodeURIComponent(labelName)}`,
        { headers: getHeaders() },
      );
      print(res.data);
    } catch (err) {
      handleCliError(err);
    }
  });

program.parse();
