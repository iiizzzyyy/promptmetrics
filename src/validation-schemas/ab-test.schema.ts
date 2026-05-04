import Joi from 'joi';

export const createABTestSchema = Joi.object({
  prompt_name: Joi.string().max(255).required(),
  version_a: Joi.string().max(255).required(),
  version_b: Joi.string().max(255).required(),
  dataset_id: Joi.number().integer().optional(),
  evaluation_id: Joi.number().integer().optional(),
  metric: Joi.string().valid('latency', 'cost', 'win_rate').optional(),
}).unknown(true);

export const runABTestSchema = Joi.object({
  scoresA: Joi.array().items(Joi.number()).min(1).optional(),
  scoresB: Joi.array().items(Joi.number()).min(1).optional(),
}).unknown(true);
