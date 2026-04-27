import { Request, Response, NextFunction } from 'express';
import { AppError } from '@errors/app.error';

const WORKSPACE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const workspaceId = req.headers['x-workspace-id'] as string | undefined;
  if (workspaceId !== undefined && !WORKSPACE_ID_REGEX.test(workspaceId)) {
    throw AppError.badRequest(
      'Invalid X-Workspace-Id header. Must be 1-128 characters and contain only letters, numbers, underscores, and hyphens.',
    );
  }
  req.workspaceId = workspaceId || 'default';
  next();
}
