import Joi from 'joi';

export const createDatasetSchema = Joi.object({
  name: Joi.string().max(128).required(),
  rows: Joi.array()
    .items(
      Joi.object({
        input: Joi.object().required(),
        expectedOutput: Joi.object().optional(),
      }).unknown(true),
    )
    .required(),
}).unknown(true);
