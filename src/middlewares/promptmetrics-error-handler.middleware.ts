import { Request, Response, NextFunction } from 'express';
import { config } from '@config/index';
import { AppError } from '@errors/app.error';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Bad Request', code: 'BAD_REQUEST', message: 'Invalid JSON body', requestId: req.requestId });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
      requestId: req.requestId,
    });
    return;
  }

  console.error(`[${req.requestId}] Unhandled error:`, err.message);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: config.nodeEnv === 'development' ? err.message : undefined,
    requestId: req.requestId,
  });
}
