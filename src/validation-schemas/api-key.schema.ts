import Joi from 'joi';

export const createApiKeySchema = Joi.object({
  name: Joi.string().max(128).required(),
  scopes: Joi.string().max(256).optional(),
  workspace_id: Joi.string().max(128).optional(),
  expires_in_days: Joi.number().integer().min(1).optional(),
}).unknown(true);
