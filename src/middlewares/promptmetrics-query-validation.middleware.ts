import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '@errors/app.error';

export function validateQuery(schema: Joi.ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      throw AppError.badRequest('Invalid query parameters', error.details.map((d) => d.message));
    }
    Object.defineProperty(req, 'query', {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
}
