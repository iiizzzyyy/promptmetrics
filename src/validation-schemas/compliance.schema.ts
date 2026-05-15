import Joi from 'joi';

export const scanComplianceSchema = Joi.object({
  prompt_name: Joi.string().optional(),
  version_tag: Joi.string().optional(),
  text: Joi.string().max(100_000).optional(),
}).custom((value, helpers) => {
  if (!value.text && !value.prompt_name) {
    return helpers.error('any.custom', { message: 'Either "text" or "prompt_name" must be provided' });
  }
  return value;
}).messages({
  'any.custom': '{{#message}}',
});
