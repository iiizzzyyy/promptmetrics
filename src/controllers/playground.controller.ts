import { Request, Response } from 'express';
import { PlaygroundProxyService } from '@services/playground.service';
import { AppError } from '@errors/app.error';
import { ProviderError } from '@services/llm-provider.adapter';

function mapProviderError(err: ProviderError): AppError {
  switch (err.code) {
    case 'rate_limit':
      return new AppError(err.message, 429, 'RATE_LIMIT');
    case 'content_policy':
      return new AppError(err.message, 400, 'CONTENT_POLICY');
    case 'timeout':
      return new AppError(err.message, 504, 'TIMEOUT');
    case 'invalid_request':
      return new AppError(err.message, 400, 'INVALID_REQUEST');
    default:
      return new AppError(err.message, 502, 'PROVIDER_ERROR');
  }
}

export class PlaygroundController {
  constructor(private service: PlaygroundProxyService) {}

  async chatCompletion(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId || 'default';
    const { provider, model, messages, variables, temperature, maxTokens, topP } = req.body;

    try {
      const response = await this.service.chatCompletion(
        workspaceId,
        provider,
        model,
        messages,
        variables,
        temperature,
        maxTokens,
        topP,
      );
      res.json(response);
    } catch (err) {
      if (err instanceof ProviderError) {
        throw mapProviderError(err);
      }
      throw err;
    }
  }

  async textCompletion(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId || 'default';
    const { provider, model, prompt, variables, temperature, maxTokens, topP } = req.body;

    try {
      const response = await this.service.textCompletion(
        workspaceId,
        provider,
        model,
        prompt,
        variables,
        temperature,
        maxTokens,
        topP,
      );
      res.json(response);
    } catch (err) {
      if (err instanceof ProviderError) {
        throw mapProviderError(err);
      }
      throw err;
    }
  }

  async streamChatCompletion(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId || 'default';
    const { provider, model, messages, variables, temperature, maxTokens, topP } = req.body;

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');

    const onClose = () => {
      if (!res.writableEnded) {
        res.end();
      }
    };
    res.on('close', onClose);

    try {
      const stream = this.service.streamChatCompletion(
        workspaceId,
        provider,
        model,
        messages,
        variables,
        temperature,
        maxTokens,
        topP,
      );

      for await (const chunk of stream) {
        if (res.writableEnded) break;
        res.write(JSON.stringify(chunk) + '\n');
        if (chunk.type === 'done' || chunk.type === 'error') {
          break;
        }
      }
    } catch (err) {
      if (!res.writableEnded) {
        const errorChunk =
          err instanceof ProviderError
            ? { type: 'error' as const, message: err.message, code: err.code }
            : {
                type: 'error' as const,
                message: err instanceof Error ? err.message : 'Internal error',
                code: 'internal_error',
              };
        res.write(JSON.stringify(errorChunk) + '\n');
      }
    } finally {
      res.off('close', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async listModels(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const workspaceId = req.workspaceId || 'default';

    const result = await this.service.listModels(workspaceId, page, limit);
    res.json(result);
  }

  async refreshModels(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const workspaceId = req.workspaceId || 'default';

    this.service.clearModelsCache();
    const result = await this.service.listModels(workspaceId, page, limit);
    res.json(result);
  }
}
