import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = req.get('x-request-id') || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
