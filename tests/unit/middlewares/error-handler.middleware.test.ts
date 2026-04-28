import { Request, Response, NextFunction } from 'express';
import { AppError } from '@errors/app.error';

jest.mock('@config/index', () => ({
  config: { nodeEnv: 'production' },
}));

import { config } from '@config/index';
import { errorHandlerMiddleware } from '@middlewares/promptmetrics-error-handler.middleware';

describe('errorHandlerMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    config.nodeEnv = 'production';
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    req = { requestId: 'req-123' };
    res = { status: statusMock, json: jsonMock, setHeader: jest.fn() };
    next = jest.fn();
  });

  it('should return 400 for SyntaxError with body', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), { body: '{invalid' });
    errorHandlerMiddleware(err, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Bad Request',
      code: 'BAD_REQUEST',
      message: 'Invalid JSON body',
      requestId: 'req-123',
    });
  });

  it('should serialize AppError with statusCode and code', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND', { field: 'id' });
    errorHandlerMiddleware(err, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Not found',
      code: 'NOT_FOUND',
      details: { field: 'id' },
      requestId: 'req-123',
    });
  });

  it('should mask 500 message in production', () => {
    config.nodeEnv = 'production';
    const err = new Error('something secret');
    errorHandlerMiddleware(err, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    const jsonArg = jsonMock.mock.calls[0][0];
    expect(jsonArg.error).toBe('Internal server error');
    expect(jsonArg.code).toBe('INTERNAL_ERROR');
    expect(jsonArg.message).toBeUndefined();
  });

  it('should expose 500 message in development', () => {
    config.nodeEnv = 'development';
    const err = new Error('dev error details');
    errorHandlerMiddleware(err, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    const jsonArg = jsonMock.mock.calls[0][0];
    expect(jsonArg.message).toBe('dev error details');
  });

  it('AppError JSON.stringify includes statusCode and code', () => {
    const err = new AppError('Bad', 400, 'BAD_REQUEST', { foo: 1 });
    const serialized = JSON.stringify(err);
    const parsed = JSON.parse(serialized);
    expect(parsed.statusCode).toBe(400);
    expect(parsed.code).toBe('BAD_REQUEST');
    expect(parsed.details).toEqual({ foo: 1 });
  });
});
