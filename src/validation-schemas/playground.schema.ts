import Joi from 'joi';

export const playgroundChatSchema = Joi.object({
  provider: Joi.string().max(64).required(),
  model: Joi.string().max(128).required(),
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('system', 'user', 'assistant').required(),
        content: Joi.string().required(),
      }).unknown(true),
    )
    .min(1)
    .required(),
  variables: Joi.object().optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  maxTokens: Joi.number().integer().min(1).optional(),
  topP: Joi.number().min(0).max(1).optional(),
}).unknown(true);

export const playgroundCompletionSchema = Joi.object({
  provider: Joi.string().max(64).required(),
  model: Joi.string().max(128).required(),
  prompt: Joi.string().required(),
  variables: Joi.object().optional(),
  temperature: Joi.number().min(0).max(2).optional(),
  maxTokens: Joi.number().integer().min(1).optional(),
  topP: Joi.number().min(0).max(1).optional(),
}).unknown(true);
