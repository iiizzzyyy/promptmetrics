import { Router } from 'express';
import { requireScope } from '@middlewares/promptmetrics-auth.middleware';
import { validateQuery } from '@middlewares/promptmetrics-query-validation.middleware';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse } from '@utils/pagination';
import { paginationQuerySchema } from '@validation-schemas/promptmetrics-pagination.schema';

export function createAuditLogRoutes(): Router {
  const router = Router();

  router.get('/v1/audit-logs', requireScope('admin'), validateQuery(paginationQuerySchema), async (req, res) => {
    const db = getDb();
    const { page, limit, offset } = parsePagination(req.query);
    const workspaceId = req.workspaceId || 'default';

    const rows = (await db
      .prepare('SELECT * FROM audit_logs WHERE workspace_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as unknown[];
    const total = (
      (await db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE workspace_id = ?').get(workspaceId)) as {
        count: number;
      }
    ).count;

    res.json(buildPaginatedResponse(rows, total, page, limit));
  });

  return router;
}
