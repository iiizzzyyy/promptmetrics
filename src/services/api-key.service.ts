import crypto from 'crypto';
import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';

export interface ApiKey {
  id: number;
  name: string;
  scopes: string;
  workspace_id: string;
  created_at: number;
  expires_at: number | null;
}

export interface CreateApiKeyInput {
  name: string;
  scopes?: string;
  workspace_id?: string;
  expires_in_days?: number;
}

export class ApiKeyService {
  async createApiKey(
    input: CreateApiKeyInput,
    callerWorkspaceId: string = 'default',
  ): Promise<{ apiKey: ApiKey; plaintextKey: string }> {
    const db = getDb();
    const plaintextKey = `pm_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = hashApiKey(plaintextKey);

    const workspaceId = input.workspace_id || callerWorkspaceId;
    const scopes = input.scopes || 'read,write';

    let expiresAt: number | null = null;
    if (input.expires_in_days !== undefined && input.expires_in_days > 0) {
      expiresAt = Math.floor(Date.now() / 1000) + input.expires_in_days * 24 * 60 * 60;
    }

    const result = await db
      .prepare(
        'INSERT INTO api_keys (key_hash, name, scopes, workspace_id, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
      )
      .run(keyHash, input.name, scopes, workspaceId, expiresAt);

    const apiKey: ApiKey = {
      id: Number(result.lastInsertRowid),
      name: input.name,
      scopes,
      workspace_id: workspaceId,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: expiresAt,
    };

    return { apiKey, plaintextKey };
  }

  async listApiKeys(
    page: number,
    limit: number,
    callerWorkspaceId: string,
    isAdmin: boolean,
  ): Promise<PaginatedResponse<ApiKey>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });

    let totalQuery = 'SELECT COUNT(*) as c FROM api_keys';
    let itemsQuery = 'SELECT id, name, scopes, workspace_id, created_at, expires_at FROM api_keys';
    const params: unknown[] = [];

    if (!isAdmin) {
      totalQuery += ' WHERE workspace_id = ?';
      itemsQuery += ' WHERE workspace_id = ?';
      params.push(callerWorkspaceId);
    }

    itemsQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const total = parseCountRow(await db.prepare(totalQuery).get(...params));
    const items = (await db.prepare(itemsQuery).all(...params, limit, offset)) as Array<{
      id: number;
      name: string;
      scopes: string;
      workspace_id: string;
      created_at: number;
      expires_at: number | null;
    }>;

    return buildPaginatedResponse(
      items.map((k) => ({
        id: k.id,
        name: k.name,
        scopes: k.scopes,
        workspace_id: k.workspace_id,
        created_at: k.created_at,
        expires_at: k.expires_at,
      })),
      total,
      page,
      limit,
    );
  }

  async deleteApiKey(id: number, callerWorkspaceId: string, isAdmin: boolean): Promise<void> {
    const db = getDb();

    let query = 'DELETE FROM api_keys WHERE id = ?';
    const params: unknown[] = [id];

    if (!isAdmin) {
      query += ' AND workspace_id = ?';
      params.push(callerWorkspaceId);
    }

    const result = await db.prepare(query).run(...params);

    if (result.changes === 0) {
      throw AppError.notFound('API key');
    }
  }
}
