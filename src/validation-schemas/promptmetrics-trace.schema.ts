import Joi from 'joi';

export const createTraceSchema = Joi.object({
  trace_id: Joi.string().uuid().optional(),
  prompt_name: Joi.string().max(128),
  version_tag: Joi.string().max(64),
  metadata: Joi.object().unknown(true).max(50).messages({
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
  metadata: Joi.object().unknown(true).max(50).messages({
    'object.max': 'metadata cannot contain more than 50 keys',
  }),
}).unknown(true);
