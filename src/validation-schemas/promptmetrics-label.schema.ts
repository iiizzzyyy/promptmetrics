import Joi from 'joi';

export const createLabelSchema = Joi.object({
  name: Joi.string().max(128).pattern(/^[a-zA-Z0-9_.-]+$/).required(),
  version_tag: Joi.string().max(64).required(),
}).unknown(true);
