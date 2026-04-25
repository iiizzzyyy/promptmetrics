import { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const workspaceId = req.headers['x-workspace-id'] as string | undefined;
  req.workspaceId = workspaceId || 'default';
  next();
}
