import Joi from 'joi';

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
}).unknown(true);

// Combined schema that accepts either offset or cursor pagination.
// When 'page' is present, offset pagination is used; otherwise cursor pagination.
export const combinedPaginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).default(50),
  cursor: Joi.string().optional(),
}).unknown(true);
