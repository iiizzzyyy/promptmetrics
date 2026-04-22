import Joi from 'joi';

const variableSchema = Joi.object({
  type: Joi.string().valid('string', 'number', 'boolean', 'array', 'object').required(),
  required: Joi.boolean().default(false),
  default: Joi.any(),
});

const modelConfigSchema = Joi.object({
  model: Joi.string(),
  temperature: Joi.number().min(0).max(2),
  max_tokens: Joi.number().integer().min(1),
  top_p: Joi.number().min(0).max(1),
  frequency_penalty: Joi.number().min(-2).max(2),
  presence_penalty: Joi.number().min(-2).max(2),
}).unknown(true);

const messageSchema = Joi.object({
  role: Joi.string().valid('system', 'user', 'assistant').required(),
  content: Joi.string().min(1).max(100000).required(),
  name: Joi.string().max(64),
}).unknown(true);

const ollamaSchema = Joi.object({
  options: Joi.object().unknown(true),
  keep_alive: Joi.string().max(16),
  format: Joi.alternatives().try(Joi.string(), Joi.object()),
}).unknown(true);

export const promptSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9-_]+$/).max(128).required().messages({
    'string.pattern.base': 'name must contain only letters, numbers, hyphens, and underscores',
  }),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required().messages({
    'string.pattern.base': 'version must be semantic (e.g., 1.0.0)',
  }),
  messages: Joi.array().items(messageSchema).min(1).required(),
  variables: Joi.object().pattern(Joi.string(), variableSchema),
  model_config: modelConfigSchema,
  ollama: ollamaSchema,
  tags: Joi.array().items(Joi.string().max(64)).max(20),
}).unknown(true);

export const createPromptSchema = promptSchema;
