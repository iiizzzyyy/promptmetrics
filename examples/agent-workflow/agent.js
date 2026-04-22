#!/usr/bin/env node
/**
 * Agent Workflow Example
 *
 * Multi-step agent with traces, spans, workflow runs, and prompt labels.
 *
 * Usage:
 *   npm install axios
 *   PROMPTMETRICS_SERVER=http://localhost:3000 \
 *   PROMPTMETRICS_API_KEY=pm_xxx \
 *   node agent.js
 */

const axios = require('axios');

const SERVER = process.env.PROMPTMETRICS_SERVER || 'http://localhost:3000';
const API_KEY = process.env.PROMPTMETRICS_API_KEY;

async function main() {
  // Step 1: Create a trace for the agent loop
  const traceRes = await axios.post(
    `${SERVER}/v1/traces`,
    { prompt_name: 'headline-agent', metadata: { agent: 'headline-v1' } },
    { headers: { 'X-API-Key': API_KEY } },
  );
  const traceId = traceRes.data.trace_id;
  console.log('Trace:', traceId);

  // Step 2: Add spans for each sub-step
  await axios.post(
    `${SERVER}/v1/traces/${traceId}/spans`,
    { name: 'fetch-prompt', status: 'ok', start_time: 0, end_time: 50 },
    { headers: { 'X-API-Key': API_KEY } },
  );

  await axios.post(
    `${SERVER}/v1/traces/${traceId}/spans`,
    { name: 'call-llm', status: 'ok', start_time: 50, end_time: 1200 },
    { headers: { 'X-API-Key': API_KEY } },
  );

  await axios.post(
    `${SERVER}/v1/traces/${traceId}/spans`,
    { name: 'parse-output', status: 'ok', start_time: 1200, end_time: 1250 },
    { headers: { 'X-API-Key': API_KEY } },
  );

  // Step 3: Create a workflow run linked to the trace
  const runRes = await axios.post(
    `${SERVER}/v1/runs`,
    {
      workflow_name: 'headline-agent',
      input: { topic: 'AI', tone: 'neutral' },
      trace_id: traceId,
    },
    { headers: { 'X-API-Key': API_KEY } },
  );
  const runId = runRes.data.run_id;
  console.log('Run:', runId);

  // Step 4: Simulate LLM work, then update the run
  await axios.patch(
    `${SERVER}/v1/runs/${runId}`,
    {
      status: 'completed',
      output: { headline: 'AI Breakthrough Reshapes Industry', score: 0.92 },
    },
    { headers: { 'X-API-Key': API_KEY } },
  );

  // Step 5: Label the prompt version as production-ready
  await axios.post(
    `${SERVER}/v1/prompts/headline-agent/labels`,
    { name: 'production', version_tag: '1.0.0' },
    { headers: { 'X-API-Key': API_KEY } },
  );

  // Step 6: Verify everything
  const trace = await axios.get(`${SERVER}/v1/traces/${traceId}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  console.log('Trace spans:', trace.data.spans.length);

  const run = await axios.get(`${SERVER}/v1/runs/${runId}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  console.log('Run status:', run.data.status);

  const label = await axios.get(`${SERVER}/v1/prompts/headline-agent/labels/production`, {
    headers: { 'X-API-Key': API_KEY },
  });
  console.log('Label version:', label.data.version_tag);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
