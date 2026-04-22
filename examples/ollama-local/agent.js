#!/usr/bin/env node
/**
 * Ollama Local Example
 *
 * 1. Fetches a prompt from PromptMetrics
 * 2. Calls a local Ollama instance
 * 3. Logs metadata back to PromptMetrics
 *
 * Usage:
 *   npm install axios
 *   PROMPTMETRICS_SERVER=http://localhost:3000 \
 *   PROMPTMETRICS_API_KEY=pm_xxx \
 *   OLLAMA_URL=http://localhost:11434 \
 *   node agent.js
 */

const axios = require('axios');

const SERVER = process.env.PROMPTMETRICS_SERVER || 'http://localhost:3000';
const API_KEY = process.env.PROMPTMETRICS_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PROMPT_NAME = process.env.PROMPT_NAME || 'welcome';

async function main() {
  // 1. Fetch prompt from PromptMetrics
  const promptRes = await axios.get(`${SERVER}/v1/prompts/${PROMPT_NAME}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  const prompt = promptRes.data;

  // 2. Call Ollama
  const start = Date.now();
  const ollamaRes = await axios.post(`${OLLAMA_URL}/api/chat`, {
    model: prompt.ollama?.model || 'llama3.1',
    messages: prompt.messages,
    options: prompt.ollama?.options || {},
    keep_alive: prompt.ollama?.keep_alive,
    format: prompt.ollama?.format,
    stream: false,
  });
  const latencyMs = Date.now() - start;

  const message = ollamaRes.data.message;

  // 3. Log metadata back to PromptMetrics
  await axios.post(
    `${SERVER}/v1/logs`,
    {
      prompt_name: prompt.name,
      version_tag: prompt.version,
      provider: 'ollama',
      model: prompt.ollama?.model || 'llama3.1',
      tokens_in: ollamaRes.data.prompt_eval_count || 0,
      tokens_out: ollamaRes.data.eval_count || 0,
      latency_ms: latencyMs,
      cost_usd: 0,
      ollama_options: prompt.ollama?.options,
      ollama_keep_alive: prompt.ollama?.keep_alive,
      ollama_format: prompt.ollama?.format,
      metadata: { user_id: 'user_123' },
    },
    { headers: { 'X-API-Key': API_KEY } },
  );

  console.log('Response:', message.content);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
