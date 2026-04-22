import Joi from 'joi';

const metadataKeySchema = Joi.string().max(128).pattern(/^[a-zA-Z0-9_.-]+$/);
const metadataValueSchema = Joi.alternatives().try(
  Joi.string().max(1024),
  Joi.number(),
  Joi.boolean(),
);

export const createTraceSchema = Joi.object({
  trace_id: Joi.string().uuid().optional(),
  prompt_name: Joi.string().max(128),
  version_tag: Joi.string().max(64),
  metadata: Joi.object().pattern(metadataKeySchema, metadataValueSchema).max(50).messages({
    'object.max': 'metadata cannot contain more than 50 keys',
  }),
}).unknown(true);

export const createSpanSchema = Joi.object({
  span_id: Joi.string().uuid().optional(),
  parent_id: Joi.string().uuid().optional(),
  name: Joi.string().max(256).required(),
  status: Joi.string().valid('ok', 'error').required(),
  start_time: Joi.number().integer().min(0),
  end_time: Joi.number().integer().min(0),
  metadata: Joi.object().pattern(metadataKeySchema, metadataValueSchema).max(50).messages({
    'object.max': 'metadata cannot contain more than 50 keys',
  }),
}).unknown(true);
