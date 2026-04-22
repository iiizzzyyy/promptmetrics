import Joi from 'joi';

const metadataKeySchema = Joi.string().max(128).pattern(/^[a-zA-Z0-9_.-]+$/);
const metadataValueSchema = Joi.alternatives().try(
  Joi.string().max(1024),
  Joi.number(),
  Joi.boolean(),
);

export const createRunSchema = Joi.object({
  run_id: Joi.string().uuid().optional(),
  workflow_name: Joi.string().max(128).required(),
  status: Joi.string().valid('running', 'completed', 'failed').optional(),
  input: Joi.object().optional(),
  output: Joi.object().optional(),
  trace_id: Joi.string().uuid().optional(),
  metadata: Joi.object().pattern(metadataKeySchema, metadataValueSchema).max(50).messages({
    'object.max': 'metadata cannot contain more than 50 keys',
  }),
}).unknown(true);

export const updateRunSchema = Joi.object({
  status: Joi.string().valid('running', 'completed', 'failed').optional(),
  output: Joi.object().optional(),
  metadata: Joi.object().pattern(metadataKeySchema, metadataValueSchema).max(50).messages({
    'object.max': 'metadata cannot contain more than 50 keys',
  }),
}).unknown(true);
