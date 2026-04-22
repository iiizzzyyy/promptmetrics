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

export const promptSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9-_]+$/).max(128).required().messages({
    'string.pattern.base': 'name must contain only letters, numbers, hyphens, and underscores',
  }),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required().messages({
    'string.pattern.base': 'version must be semantic (e.g., 1.0.0)',
  }),
  template: Joi.string().min(1).max(100000).required(),
  variables: Joi.object().pattern(Joi.string(), variableSchema),
  model_config: modelConfigSchema,
  tags: Joi.array().items(Joi.string().max(64)).max(20),
}).unknown(true);

export const createPromptSchema = promptSchema;
