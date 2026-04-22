#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const program = new Command();

program.name('promptmetrics').description('PromptMetrics CLI').version('1.0.0');

program
  .command('init')
  .description('Create a promptmetrics.yaml config file')
  .action(() => {
    const configPath = path.resolve('promptmetrics.yaml');
    if (fs.existsSync(configPath)) {
      console.log('promptmetrics.yaml already exists.');
      return;
    }
    const content = `server: http://localhost:3000
api_key: your-api-key-here
`;
    fs.writeFileSync(configPath, content);
    console.log('Created promptmetrics.yaml');
  });

program
  .command('create-prompt')
  .description('Create a new prompt from a JSON file')
  .requiredOption('--file <path>', 'Path to prompt JSON file')
  .option('--server <url>', 'Server URL', 'http://localhost:3000')
  .option('--api-key <key>', 'API key')
  .action(async (options) => {
    const content = JSON.parse(fs.readFileSync(options.file, 'utf-8'));
    const res = await axios.post(`${options.server}/v1/prompts`, content, {
      headers: { 'X-API-Key': options.apiKey },
    });
    console.log(JSON.stringify(res.data, null, 2));
  });

program
  .command('list-prompts')
  .description('List all prompts')
  .option('--server <url>', 'Server URL', 'http://localhost:3000')
  .option('--api-key <key>', 'API key')
  .action(async (options) => {
    const res = await axios.get(`${options.server}/v1/prompts`, {
      headers: { 'X-API-Key': options.apiKey },
    });
    console.table((res.data as { items: unknown[] }).items);
  });

program
  .command('get-prompt')
  .description('Get a prompt by name')
  .requiredOption('--name <name>', 'Prompt name')
  .option('--version <version>', 'Prompt version')
  .option('--server <url>', 'Server URL', 'http://localhost:3000')
  .option('--api-key <key>', 'API key')
  .action(async (options) => {
    const url = options.version
      ? `${options.server}/v1/prompts/${options.name}?version=${options.version}`
      : `${options.server}/v1/prompts/${options.name}`;
    const res = await axios.get(url, {
      headers: { 'X-API-Key': options.apiKey },
    });
    console.log(JSON.stringify(res.data, null, 2));
  });

program
  .command('import')
  .description('Import prompts from a directory of JSON files')
  .requiredOption('--dir <path>', 'Directory containing prompt JSON files')
  .option('--server <url>', 'Server URL', 'http://localhost:3000')
  .option('--api-key <key>', 'API key')
  .action(async (options) => {
    const files = fs.readdirSync(options.dir).filter((f: string) => f.endsWith('.json'));
    const results = [];
    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(options.dir, file), 'utf-8'));
      try {
        const res = await axios.post(`${options.server}/v1/prompts`, content, {
          headers: { 'X-API-Key': options.apiKey },
        });
        results.push({ file, status: 'created', name: (res.data as { name: string }).name });
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
        results.push({
          file,
          status: 'error',
          message: axiosErr.response?.data?.error || axiosErr.message || 'Unknown error',
        });
      }
    }
    console.table(results);
  });

program
  .command('export')
  .description('Export all prompts to a directory')
  .requiredOption('--out <path>', 'Output directory')
  .option('--server <url>', 'Server URL', 'http://localhost:3000')
  .option('--api-key <key>', 'API key')
  .action(async (options) => {
    const res = await axios.get(`${options.server}/v1/prompts?limit=1000`, {
      headers: { 'X-API-Key': options.apiKey },
    });
    const prompts = (res.data as { items: { name: string }[] }).items;

    if (!fs.existsSync(options.out)) {
      fs.mkdirSync(options.out, { recursive: true });
    }

    for (const prompt of prompts) {
      const detailRes = await axios.get(`${options.server}/v1/prompts/${prompt.name}`, {
        headers: { 'X-API-Key': options.apiKey },
      });
      const content = (detailRes.data as { content: unknown }).content;
      fs.writeFileSync(
        path.join(options.out, `${prompt.name}.json`),
        JSON.stringify(content, null, 2),
      );
    }

    console.log(`Exported ${prompts.length} prompts to ${options.out}`);
  });

program.parse();
