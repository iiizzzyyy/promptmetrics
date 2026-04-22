import { Request, Response } from 'express';
import { getDb } from '@models/promptmetrics-sqlite';
import { createLabelSchema } from '@validation-schemas/promptmetrics-label.schema';

export class LabelController {
  async createLabel(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;
    const { error, value } = createLabelSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(422).json({
        error: 'Validation failed',
        details: error.details.map((d) => d.message),
      });
      return;
    }

    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO prompt_labels (prompt_name, name, version_tag) VALUES (?, ?, ?)
         ON CONFLICT(prompt_name, name) DO UPDATE SET version_tag = excluded.version_tag`,
      ).run(promptName, value.name, value.version_tag);

      res.status(201).json({
        prompt_name: promptName,
        name: value.name,
        version_tag: value.version_tag,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create label', message: (err as Error).message });
    }
  }

  async listLabels(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;

    try {
      const db = getDb();
      const items = db
        .prepare('SELECT * FROM prompt_labels WHERE prompt_name = ? ORDER BY created_at DESC')
        .all(promptName) as Array<{
        prompt_name: string;
        name: string;
        version_tag: string;
        created_at: number;
      }>;

      res.status(200).json({
        items: items.map((l) => ({
          prompt_name: l.prompt_name,
          name: l.name,
          version_tag: l.version_tag,
          created_at: l.created_at,
        })),
        total: items.length,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list labels', message: (err as Error).message });
    }
  }

  async getLabel(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;
    const labelName = req.params.label_name as string;

    try {
      const db = getDb();
      const label = db
        .prepare('SELECT * FROM prompt_labels WHERE prompt_name = ? AND name = ?')
        .get(promptName, labelName) as
        | { prompt_name: string; name: string; version_tag: string; created_at: number }
        | undefined;

      if (!label) {
        res.status(404).json({ error: 'Label not found' });
        return;
      }

      res.status(200).json({
        prompt_name: label.prompt_name,
        name: label.name,
        version_tag: label.version_tag,
        created_at: label.created_at,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get label', message: (err as Error).message });
    }
  }

  async deleteLabel(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;
    const labelName = req.params.label_name as string;

    try {
      const db = getDb();
      const result = db
        .prepare('DELETE FROM prompt_labels WHERE prompt_name = ? AND name = ?')
        .run(promptName, labelName);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Label not found' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete label', message: (err as Error).message });
    }
  }
}
