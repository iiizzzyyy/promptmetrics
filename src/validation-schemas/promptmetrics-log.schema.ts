import Joi from 'joi';

const metadataKeySchema = Joi.string().max(128).pattern(/^[a-zA-Z0-9_.-]+$/);
const metadataValueSchema = Joi.alternatives().try(
  Joi.string().max(1024),
  Joi.number(),
  Joi.boolean(),
);

export const logMetadataSchema = Joi.object({
  prompt_name: Joi.string().max(128).required(),
  version_tag: Joi.string().max(64).required(),
  provider: Joi.string().max(64),
  model: Joi.string().max(128),
  tokens_in: Joi.number().integer().min(0),
  tokens_out: Joi.number().integer().min(0),
  latency_ms: Joi.number().integer().min(0),
  cost_usd: Joi.number().min(0),
  ollama_options: Joi.object().unknown(true),
  ollama_keep_alive: Joi.string().max(16),
  ollama_format: Joi.alternatives().try(Joi.string(), Joi.object()),
  metadata: Joi.object().pattern(metadataKeySchema, metadataValueSchema).max(50).messages({
    'object.max': 'metadata cannot contain more than 50 keys',
  }),
}).unknown(true);
