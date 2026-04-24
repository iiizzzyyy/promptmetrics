import { AppError } from '@errors/app.error';
import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse } from '@utils/pagination';

export interface Label {
  prompt_name: string;
  name: string;
  version_tag: string;
  created_at: number;
}

export interface CreateLabelInput {
  name: string;
  version_tag: string;
}

export class LabelService {
  createLabel(promptName: string, input: CreateLabelInput): Label {
    const db = getDb();
    db.prepare(
      `INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)
       ON CONFLICT(prompt_name, name) DO UPDATE SET version_tag = excluded.version_tag`,
    ).run(promptName, input.name, input.version_tag);

    return {
      prompt_name: promptName,
      name: input.name,
      version_tag: input.version_tag,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  listLabels(promptName: string, page: number, limit: number): PaginatedResponse<Label> {
    const db = getDb();
    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const total = (
      db.prepare('SELECT COUNT(*) as c FROM prompt_labels WHERE prompt_name = ?').get(promptName) as { c: number }
    ).c;
    const items = db
      .prepare('SELECT * FROM prompt_labels WHERE prompt_name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(promptName, limit, offset) as Array<{
      prompt_name: string;
      name: string;
      version_tag: string;
      created_at: number;
    }>;

    return buildPaginatedResponse(
      items.map((l) => ({
        prompt_name: l.prompt_name,
        name: l.name,
        version_tag: l.version_tag,
        created_at: l.created_at,
      })),
      total,
      page,
      limit,
    );
  }

  getLabel(promptName: string, labelName: string): Label {
    const db = getDb();
    const label = db
      .prepare('SELECT * FROM prompt_labels WHERE prompt_name = ? AND name = ?')
      .get(promptName, labelName) as
      | { prompt_name: string; name: string; version_tag: string; created_at: number }
      | undefined;

    if (!label) {
      throw AppError.notFound('Label');
    }

    return {
      prompt_name: label.prompt_name,
      name: label.name,
      version_tag: label.version_tag,
      created_at: label.created_at,
    };
  }

  deleteLabel(promptName: string, labelName: string): void {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM prompt_labels WHERE prompt_name = ? AND name = ?')
      .run(promptName, labelName);

    if (result.changes === 0) {
      throw AppError.notFound('Label');
    }
  }
}
