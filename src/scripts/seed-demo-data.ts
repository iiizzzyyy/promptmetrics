import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '@models/promptmetrics-sqlite';
import { DatabaseAdapter } from '@models/database.interface';
import dotenv from 'dotenv';

dotenv.config();

const salt = process.env.API_KEY_SALT || 'dev-salt-for-github-driver-test';
const promptsPath = './prompts';
const workspaceId = 'default';
const force = process.argv.includes('--force');

function hashApiKey(key: string): string {
  return crypto.createHmac('sha256', salt).update(key).digest('hex');
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

const prompts = [
  {
    name: 'customer-support',
    versions: ['1.0.0', '1.1.0'],
    messages: [
      { role: 'system', content: 'You are a helpful customer support agent.' },
      { role: 'user', content: 'Customer inquiry: {{issue}}' },
    ],
    variables: { issue: { type: 'string', required: true } },
  },
  {
    name: 'summarizer',
    versions: ['1.0.0', '2.0.0'],
    messages: [
      { role: 'system', content: 'Summarize the following text concisely.' },
      { role: 'user', content: '{{text}}' },
    ],
    variables: { text: { type: 'string', required: true } },
  },
  {
    name: 'code-reviewer',
    versions: ['1.0.0'],
    messages: [
      { role: 'system', content: 'You are a senior code reviewer.' },
      { role: 'user', content: 'Review this code:\n```\n{{code}}\n```' },
    ],
    variables: { code: { type: 'string', required: true } },
  },
  {
    name: 'onboarding',
    versions: ['1.0.0', '1.1.0', '1.2.0'],
    messages: [
      { role: 'system', content: 'You are a friendly onboarding assistant.' },
      { role: 'user', content: 'Welcome {{name}}! Your role is {{role}}.' },
    ],
    variables: { name: { type: 'string', required: true }, role: { type: 'string', required: true } },
  },
];

const models = [
  { name: 'gpt-4o', provider: 'openai', costPer1MIn: 5, costPer1MOut: 15 },
  { name: 'gpt-3.5-turbo', provider: 'openai', costPer1MIn: 0.5, costPer1MOut: 1.5 },
  { name: 'claude-3-sonnet', provider: 'anthropic', costPer1MIn: 3, costPer1MOut: 15 },
  { name: 'llama3.1', provider: 'ollama', costPer1MIn: 0, costPer1MOut: 0 },
];

const workflowNames = ['headline-agent', 'support-bot', 'doc-summarizer', 'code-linter', 'tweet-generator'];
const spanNames = ['fetch-prompt', 'llm-call', 'parse-response', 'save-result', 'validate-output'];
const evaluationNames = ['Accuracy', 'Relevance', 'Safety'];

function writePromptFile(promptName: string, version: string, data: object): void {
  const dir = path.join(promptsPath, promptName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${version}.json`), JSON.stringify(data, null, 2));
}

async function seedApiKey(db: DatabaseAdapter): Promise<void> {
  const key = 'pm_smoke_test_key';
  const hash = hashApiKey(key);
  await db
    .prepare('INSERT OR IGNORE INTO api_keys (key_hash, name, scopes, workspace_id) VALUES (?, ?, ?, ?)')
    .run(hash, 'smoke', 'read,write', workspaceId);
  console.log('Seeded API key: pm_smoke_test_key');
}

async function seedPrompts(db: DatabaseAdapter): Promise<void> {
  for (const p of prompts) {
    for (const version of p.versions) {
      const promptData = {
        name: p.name,
        version,
        messages: p.messages,
        variables: p.variables,
      };
      writePromptFile(p.name, version, promptData);

      const createdAt = nowSec() - randomInt(1, 86400 * 60);
      await db
        .prepare(
          `INSERT INTO prompts (name, version_tag, commit_sha, driver, created_at, status, workspace_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(name, version_tag) DO UPDATE SET
             driver = excluded.driver,
             created_at = excluded.created_at,
             status = excluded.status`,
        )
        .run(p.name, version, '', 'filesystem', createdAt, 'active', workspaceId);
    }
  }
  console.log(`Seeded ${prompts.length} prompts with ${prompts.reduce((a, p) => a + p.versions.length, 0)} versions`);
}

async function seedLogs(db: DatabaseAdapter, startSec: number, endSec: number, runIds: string[]): Promise<number> {
  const insert = db.prepare(
    `INSERT INTO logs (prompt_name, version_tag, metadata_json, provider, model, tokens_in, tokens_out, latency_ms, cost_usd, created_at, workspace_id, run_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let count = 0;
  for (let day = startSec; day < endSec; day += 86400) {
    const perDay = randomInt(8, 20);
    for (let i = 0; i < perDay; i++) {
      const prompt = randomItem(prompts);
      const version = randomItem(prompt.versions);
      const model = randomItem(models);
      const tokensIn = randomInt(50, 2000);
      const tokensOut = randomInt(20, 1500);
      const latencyMs = randomInt(100, 800);
      const costUsd = (tokensIn * model.costPer1MIn + tokensOut * model.costPer1MOut) / 1_000_000;
      const createdAt = day + randomInt(0, 86399);
      const runId = runIds.length > 0 && Math.random() < 0.3 ? randomItem(runIds) : null;

      await insert.run(
        prompt.name,
        version,
        JSON.stringify({ user_id: `user_${randomInt(1, 100)}` }),
        model.provider,
        model.name,
        tokensIn,
        tokensOut,
        latencyMs,
        costUsd,
        createdAt,
        workspaceId,
        runId,
      );
      count++;
    }
  }
  console.log(`Seeded ${count} logs`);
  return count;
}

async function seedTracesAndSpans(db: DatabaseAdapter, startSec: number, endSec: number): Promise<number> {
  const insertTrace = db.prepare(
    `INSERT INTO traces (trace_id, prompt_name, version_tag, metadata_json, created_at, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertSpan = db.prepare(
    `INSERT INTO spans (trace_id, span_id, parent_id, name, status, start_time, end_time, metadata_json, created_at, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let traceCount = 0;
  for (let day = startSec; day < endSec; day += 86400) {
    const perDay = randomInt(2, 4);
    for (let i = 0; i < perDay; i++) {
      const prompt = randomItem(prompts);
      const version = randomItem(prompt.versions);
      const traceId = crypto.randomUUID();
      const traceCreated = day + randomInt(0, 86399);

      await insertTrace.run(
        traceId,
        prompt.name,
        version,
        JSON.stringify({ agent: 'demo-agent', loop: randomInt(1, 5) }),
        traceCreated,
        workspaceId,
      );
      traceCount++;

      const numSpans = randomInt(2, 4);
      for (let s = 0; s < numSpans; s++) {
        const startTime = traceCreated + s * randomInt(100, 500);
        const endTime = startTime + randomInt(50, 400);
        const status = Math.random() < 0.2 ? 'error' : 'ok';
        await insertSpan.run(
          traceId,
          crypto.randomUUID(),
          s === 0 ? null : crypto.randomUUID(),
          randomItem(spanNames),
          status,
          startTime,
          endTime,
          JSON.stringify({ step: s + 1 }),
          endTime,
          workspaceId,
        );
      }
    }
  }
  console.log(`Seeded ${traceCount} traces with spans`);
  return traceCount;
}

async function seedRuns(db: DatabaseAdapter, startSec: number, endSec: number): Promise<string[]> {
  const insert = db.prepare(
    `INSERT INTO runs (run_id, workflow_name, status, input_json, output_json, trace_id, metadata_json, created_at, updated_at, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const runIds: string[] = [];
  for (let day = startSec; day < endSec; day += 86400) {
    const perDay = randomInt(4, 10);
    for (let i = 0; i < perDay; i++) {
      const roll = Math.random();
      const status = roll < 0.7 ? 'completed' : roll < 0.85 ? 'running' : 'failed';
      const createdAt = day + randomInt(0, 86399);
      const updatedAt = status === 'running' ? createdAt : createdAt + randomInt(30, 600);
      const runId = crypto.randomUUID();

      await insert.run(
        runId,
        randomItem(workflowNames),
        status,
        JSON.stringify({ topic: `topic-${randomInt(1, 50)}` }),
        status === 'completed' ? JSON.stringify({ result: `result-${randomInt(1, 100)}` }) : null,
        null,
        JSON.stringify({ env: 'demo' }),
        createdAt,
        updatedAt,
        workspaceId,
      );
      runIds.push(runId);
    }
  }
  console.log(`Seeded ${runIds.length} runs`);
  return runIds;
}

async function seedEvaluations(db: DatabaseAdapter, startSec: number, endSec: number): Promise<void> {
  const insertEval = db.prepare(
    `INSERT INTO evaluations (name, description, prompt_name, version_tag, criteria_json, created_at, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertResult = db.prepare(
    `INSERT INTO evaluation_results (evaluation_id, run_id, score, metadata_json, created_at, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const evalName of evaluationNames) {
    const prompt = randomItem(prompts);
    const version = randomItem(prompt.versions);
    const evalCreated = nowSec() - randomInt(1, 86400 * 30);

    const evalInfo = await insertEval.run(
      evalName,
      `${evalName} evaluation for ${prompt.name}`,
      prompt.name,
      version,
      JSON.stringify({ threshold: 0.75 }),
      evalCreated,
      workspaceId,
    );
    const evaluationId = evalInfo.lastInsertRowid as number;

    let resultCount = 0;
    for (let day = startSec; day < endSec; day += 86400) {
      const perDay = randomInt(3, 6);
      for (let i = 0; i < perDay; i++) {
        const score = randomFloat(0.65, 0.95);
        await insertResult.run(
          evaluationId,
          crypto.randomUUID(),
          score,
          JSON.stringify({ judge: 'gpt-4o' }),
          day + randomInt(0, 86399),
          workspaceId,
        );
        resultCount++;
      }
    }
    console.log(`Seeded ${resultCount} results for evaluation "${evalName}"`);
  }
}

async function main(): Promise<void> {
  console.log('Seeding PromptMetrics demo data...');

  const db = getDb();

  if (!force) {
    const ninetyDaysAgo = nowSec() - 90 * 86400;
    const existing = (await db
      .prepare('SELECT COUNT(*) as c FROM logs WHERE workspace_id = ? AND created_at >= ?')
      .get(workspaceId, ninetyDaysAgo)) as { c: number };
    if (existing.c > 100) {
      console.log(`Found ${existing.c} existing log rows in the last 90 days. Skipping seed. Use --force to re-seed.`);
      await db.close();
      process.exit(0);
    }
  }

  if (force) {
    console.log('Force mode: clearing existing demo data...');
    await db.transaction(async (trx) => {
      await trx.prepare('DELETE FROM evaluation_results WHERE workspace_id = ?').run(workspaceId);
      await trx.prepare('DELETE FROM evaluations WHERE workspace_id = ?').run(workspaceId);
      await trx.prepare('DELETE FROM spans WHERE workspace_id = ?').run(workspaceId);
      await trx.prepare('DELETE FROM traces WHERE workspace_id = ?').run(workspaceId);
      await trx.prepare('DELETE FROM runs WHERE workspace_id = ?').run(workspaceId);
      await trx.prepare('DELETE FROM logs WHERE workspace_id = ?').run(workspaceId);
      await trx.prepare('DELETE FROM prompts WHERE workspace_id = ?').run(workspaceId);
      await trx.prepare("DELETE FROM api_keys WHERE workspace_id = ? AND name = 'smoke'").run(workspaceId);
    });
  }

  const endSec = nowSec();
  const startSec = endSec - 90 * 86400;

  await seedApiKey(db);
  await seedPrompts(db);
  const runIds = await seedRuns(db, startSec, endSec);
  await seedLogs(db, startSec, endSec, runIds);
  await seedTracesAndSpans(db, startSec, endSec);
  await seedEvaluations(db, startSec, endSec);

  await db.close();
  console.log('Demo data seeded successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
