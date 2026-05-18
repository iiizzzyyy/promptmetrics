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
    return new AppError(message, 400, 'BAD_REQUEST', details, details ? 'context' : undefined);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
  }

  /** Validation error with structured details.
   *  Accepts either a string[] (from Joi) or an ErrorDetails object.
   *  String arrays are normalized to { fields: string[] }.
   */
  static validationFailed(details: string[] | ErrorDetails): AppError {
    const normalized: ErrorDetails = Array.isArray(details) ? { fields: details } : details;
    return new AppError('Validation failed', 422, 'VALIDATION_FAILED', normalized, 'fields');
  }

  static internal(message?: string): AppError {
    return new AppError(message || 'Internal server error', 500, 'INTERNAL_ERROR');
  }

  static notImplemented(message = 'Not yet implemented'): AppError {
    return new AppError(message, 501, 'NOT_IMPLEMENTED');
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      ...(this.details !== undefined ? { details: this.details } : {}),
      ...(this.detailsType !== undefined ? { detailsType: this.detailsType } : {}),
    };
  }
}
