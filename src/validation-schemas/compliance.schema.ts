import Joi from 'joi';

export const scanComplianceSchema = Joi.object({
  prompt_name: Joi.string().required(),
  version_tag: Joi.string().required(),
  text: Joi.string().max(100_000).required(),
});
