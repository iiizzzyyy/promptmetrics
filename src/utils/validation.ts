import { AppError } from '@errors/app.error';

export function parseIdParam(raw: string | string[]): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    throw AppError.badRequest(`Invalid ID parameter: ${value}`);
  }
  return id;
}
