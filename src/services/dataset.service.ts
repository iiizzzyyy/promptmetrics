import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';
import { safeJsonParse } from '@utils/safe-json';

export interface DatasetRow {
  id: number;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
}

export interface Dataset {
  id: number;
  name: string;
  row_count: number;
  schema?: Record<string, unknown>;
  created_at: number;
}

export interface DatasetWithPreview extends Dataset {
  preview: DatasetRow[];
}

export interface CreateDatasetInput {
  name: string;
  rows: Array<{ input: Record<string, unknown>; expectedOutput?: Record<string, unknown> }>;
}

const MAX_ROWS = 10_000;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

export class DatasetService {
  async createDataset(input: CreateDatasetInput, workspaceId: string = 'default'): Promise<Dataset> {
    if (input.rows.length > MAX_ROWS) {
      throw AppError.badRequest(`Dataset cannot exceed ${MAX_ROWS} rows`);
    }

    const payloadSize = JSON.stringify(input.rows).length;
    if (payloadSize > MAX_PAYLOAD_BYTES) {
      throw AppError.badRequest(`Dataset payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
    }

    const db = getDb();

    return db.transaction(async () => {
      const datasetResult = await db
        .prepare('INSERT INTO datasets (name, workspace_id, row_count) VALUES (?, ?, 0)')
        .run(input.name, workspaceId);

      const datasetId = Number(datasetResult.lastInsertRowid);

      if (input.rows.length > 0) {
        const insertRow = db.prepare(
          'INSERT INTO dataset_rows (dataset_id, input_json, expected_output_json, workspace_id) VALUES (?, ?, ?, ?)',
        );

        for (const row of input.rows) {
          await insertRow.run(
            datasetId,
            JSON.stringify(row.input),
            row.expectedOutput ? JSON.stringify(row.expectedOutput) : null,
            workspaceId,
          );
        }

        await db
          .prepare('UPDATE datasets SET row_count = ? WHERE id = ? AND workspace_id = ?')
          .run(input.rows.length, datasetId, workspaceId);
      }

      return {
        id: datasetId,
        name: input.name,
        row_count: input.rows.length,
        created_at: Math.floor(Date.now() / 1000),
      };
    });
  }

  async listDatasets(
    page: number,
    limit: number,
    workspaceId: string = 'default',
  ): Promise<PaginatedResponse<Dataset>> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM datasets WHERE workspace_id = ?').get(workspaceId),
    );

    const items = (await db
      .prepare('SELECT * FROM datasets WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(workspaceId, limit, offset)) as Array<{
      id: number;
      name: string;
      row_count: number;
      schema_json: string | null;
      created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((d) => ({
        id: d.id,
        name: d.name,
        row_count: d.row_count,
        schema: safeJsonParse(d.schema_json, undefined),
        created_at: d.created_at,
      })),
      total,
      page,
      limit,
    );
  }

  async getDataset(id: number, workspaceId: string = 'default'): Promise<DatasetWithPreview> {
    const db = getDb();
    const dataset = (await db
      .prepare('SELECT * FROM datasets WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)) as
      | {
          id: number;
          name: string;
          row_count: number;
          schema_json: string | null;
          created_at: number;
        }
      | undefined;

    if (!dataset) {
      throw AppError.notFound('Dataset');
    }

    const rows = (await db
      .prepare('SELECT * FROM dataset_rows WHERE dataset_id = ? AND workspace_id = ? ORDER BY id ASC LIMIT 5')
      .all(id, workspaceId)) as Array<{
      id: number;
      input_json: string;
      expected_output_json: string | null;
    }>;

    return {
      id: dataset.id,
      name: dataset.name,
      row_count: dataset.row_count,
      schema: safeJsonParse(dataset.schema_json, undefined),
      created_at: dataset.created_at,
      preview: rows.map((r) => ({
        id: r.id,
        input: safeJsonParse(r.input_json, {}) as Record<string, unknown>,
        expectedOutput: r.expected_output_json
          ? (safeJsonParse(r.expected_output_json, {}) as Record<string, unknown>)
          : undefined,
      })),
    };
  }

  async deleteDataset(id: number, workspaceId: string = 'default'): Promise<void> {
    const db = getDb();
    await db.prepare('DELETE FROM dataset_rows WHERE dataset_id = ? AND workspace_id = ?').run(id, workspaceId);

    const result = await db.prepare('DELETE FROM datasets WHERE id = ? AND workspace_id = ?').run(id, workspaceId);

    if (result.changes === 0) {
      throw AppError.notFound('Dataset');
    }
  }
}
