#!/usr/bin/env node
/**
 * Docker Compose Smoke Test
 *
 * Exercises the full PromptMetrics flow against the server container.
 */

const axios = require('axios');

const SERVER = process.env.SERVER_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'pm_smoke_test_key';

async function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${msg} — expected ${expected}, got ${actual}`);
  }
  console.log(`PASS: ${msg}`);
}

async function main() {
  const headers = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY };

  // 1. Health check
  const health = await axios.get(`${SERVER}/health`);
  await assertEqual(health.data.status, 'ok', 'health check');

  // 2. Create prompt
  const promptRes = await axios.post(
    `${SERVER}/v1/prompts`,
    {
      name: 'smoke-prompt',
      version: '1.0.0',
      messages: [
        { role: 'system', content: 'You are a test assistant.' },
        { role: 'user', content: 'Hello {{name}}!' },
      ],
      variables: { name: { type: 'string', required: true } },
    },
    { headers },
  );
  await assertEqual(promptRes.data.name, 'smoke-prompt', 'create prompt');

  // 3. Get and render prompt
  const getRes = await axios.get(`${SERVER}/v1/prompts/smoke-prompt?variables[name]=World`, { headers });
  const userMsg = getRes.data.content.messages.find((m) => m.role === 'user');
  await assertEqual(userMsg.content, 'Hello World!', 'render prompt');

  // 4. Log metadata
  const logRes = await axios.post(
    `${SERVER}/v1/logs`,
    {
      prompt_name: 'smoke-prompt',
      version_tag: '1.0.0',
      provider: 'openai',
      model: 'gpt-4o',
      tokens_in: 10,
      tokens_out: 20,
      latency_ms: 500,
      cost_usd: 0.001,
    },
    { headers },
  );
  await assertEqual(logRes.data.status, 'accepted', 'log metadata');

  // 5. Create trace
  const traceRes = await axios.post(
    `${SERVER}/v1/traces`,
    { prompt_name: 'smoke-prompt', metadata: { agent: 'smoke' } },
    { headers },
  );
  const traceId = traceRes.data.trace_id;
  await assertEqual(traceRes.data.status, 'created', 'create trace');

  // 6. Add span
  const spanRes = await axios.post(
    `${SERVER}/v1/traces/${traceId}/spans`,
    { name: 'llm-call', status: 'ok', start_time: 100, end_time: 600 },
    { headers },
  );
  await assertEqual(spanRes.data.status, 'ok', 'add span');

  // 7. Create run
  const runRes = await axios.post(
    `${SERVER}/v1/runs`,
    { workflow_name: 'smoke-workflow', input: { topic: 'test' } },
    { headers },
  );
  const runId = runRes.data.run_id;
  await assertEqual(runRes.data.status, 'running', 'create run');

  // 8. Update run
  const updateRes = await axios.patch(
    `${SERVER}/v1/runs/${runId}`,
    { status: 'completed', output: { result: 'pass' } },
    { headers },
  );
  await assertEqual(updateRes.data.status, 'updated', 'update run');

  // 9. Add label
  const labelRes = await axios.post(
    `${SERVER}/v1/prompts/smoke-prompt/labels`,
    { name: 'production', version_tag: '1.0.0' },
    { headers },
  );
  await assertEqual(labelRes.data.name, 'production', 'add label');

  // 10. Get label
  const getLabelRes = await axios.get(`${SERVER}/v1/prompts/smoke-prompt/labels/production`, { headers });
  await assertEqual(getLabelRes.data.version_tag, '1.0.0', 'get label');

  console.log('\nAll smoke tests passed.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
