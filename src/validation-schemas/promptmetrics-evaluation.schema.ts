import Joi from 'joi';

export const createEvaluationSchema = Joi.object({
  name: Joi.string().max(128).required(),
  description: Joi.string().max(1024).optional(),
  prompt_name: Joi.string().max(128).required(),
  version_tag: Joi.string().max(64).optional(),
  criteria: Joi.object().optional(),
}).unknown(true);

export const createEvaluationResultSchema = Joi.object({
  run_id: Joi.string().max(128).optional(),
  score: Joi.number().min(0).max(1).optional(),
  metadata: Joi.object().optional(),
}).unknown(true);
