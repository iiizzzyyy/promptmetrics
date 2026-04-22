#!/usr/bin/env node
/**
 * OpenAI Chatbot Example
 *
 * 1. Fetches a prompt from PromptMetrics
 * 2. Calls OpenAI with the prompt messages
 * 3. Logs metadata back to PromptMetrics
 *
 * Usage:
 *   npm install openai axios
 *   PROMPTMETRICS_SERVER=http://localhost:3000 \
 *   PROMPTMETRICS_API_KEY=pm_xxx \
 *   OPENAI_API_KEY=sk-xxx \
 *   node agent.js
 */

const axios = require('axios');
const OpenAI = require('openai');

const SERVER = process.env.PROMPTMETRICS_SERVER || 'http://localhost:3000';
const API_KEY = process.env.PROMPTMETRICS_API_KEY;
const PROMPT_NAME = process.env.PROMPT_NAME || 'welcome';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  // 1. Fetch prompt from PromptMetrics
  const promptRes = await axios.get(`${SERVER}/v1/prompts/${PROMPT_NAME}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  const prompt = promptRes.data;

  // 2. Call OpenAI
  const start = Date.now();
  const completion = await openai.chat.completions.create({
    model: prompt.model_config?.model || 'gpt-4o',
    messages: prompt.messages,
    temperature: prompt.model_config?.temperature ?? 0.7,
  });
  const latencyMs = Date.now() - start;

  // 3. Log metadata back to PromptMetrics
  await axios.post(
    `${SERVER}/v1/logs`,
    {
      prompt_name: prompt.name,
      version_tag: prompt.version,
      provider: 'openai',
      model: completion.model,
      tokens_in: completion.usage?.prompt_tokens || 0,
      tokens_out: completion.usage?.completion_tokens || 0,
      latency_ms: latencyMs,
      cost_usd: 0.001, // replace with your own estimator
      metadata: { user_id: 'user_123', experiment: 'headline-v2' },
    },
    { headers: { 'X-API-Key': API_KEY } },
  );

  console.log('Response:', completion.choices[0].message.content);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
