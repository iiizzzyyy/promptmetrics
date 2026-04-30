import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '@errors/app.error';

export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }
    req.body = value;
    next();
  };
}
