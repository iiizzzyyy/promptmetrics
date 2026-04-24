import { Request, Response } from 'express';
import { AppError } from '@errors/app.error';
import { LabelService } from '@services/label.service';
import { createLabelSchema } from '@validation-schemas/promptmetrics-label.schema';

export class LabelController {
  constructor(private service: LabelService) {}

  async createLabel(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;
    const { error, value } = createLabelSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw AppError.validationFailed(error.details.map((d) => d.message));
    }

    const label = this.service.createLabel(promptName, value);

    res.status(201).json({
      prompt_name: label.prompt_name,
      name: label.name,
      version_tag: label.version_tag,
    });
  }

  async listLabels(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const result = this.service.listLabels(promptName, page, limit);
    res.status(200).json(result);
  }

  async getLabel(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;
    const labelName = req.params.label_name as string;

    const label = this.service.getLabel(promptName, labelName);

    res.status(200).json({
      prompt_name: label.prompt_name,
      name: label.name,
      version_tag: label.version_tag,
      created_at: label.created_at,
    });
  }

  async deleteLabel(req: Request, res: Response): Promise<void> {
    const promptName = req.params.name as string;
    const labelName = req.params.label_name as string;

    this.service.deleteLabel(promptName, labelName);
    res.status(204).send();
  }
}
