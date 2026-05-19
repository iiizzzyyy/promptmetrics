export type ErrorDetails = Record<string, unknown>;

export type ErrorDetailsType = 'fields' | 'context';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly detailsType?: ErrorDetailsType;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: ErrorDetails,
    detailsType?: ErrorDetailsType,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.detailsType = detailsType;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details, 'context');
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED', undefined, 'context');
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403, 'FORBIDDEN', undefined, 'context');
  }

  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND', undefined, 'context');
  }

  /** Validation error with structured details.
   *  Accepts either a string[] (from Joi) or an ErrorDetails object.
   *  All inputs are normalized to { fields: string[] } for consistent client parsing.
   */
  static validationFailed(details: string[] | ErrorDetails): AppError {
    const normalized: ErrorDetails = Array.isArray(details)
      ? { fields: details }
      : { fields: Object.values(details).map(String) };
    return new AppError('Validation failed', 422, 'VALIDATION_FAILED', normalized, 'fields');
  }

  static internal(message?: string): AppError {
    return new AppError(message || 'Internal server error', 500, 'INTERNAL_ERROR', undefined, 'context');
  }

  static notImplemented(message = 'Not yet implemented'): AppError {
    return new AppError(message, 501, 'NOT_IMPLEMENTED', undefined, 'context');
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      ...(this.details !== undefined ? { details: this.details } : {}),
      detailsType: this.detailsType,
    };
  }
}
