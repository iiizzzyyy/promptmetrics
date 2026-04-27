import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function createWebhookRoutes(driver: PromptDriver): Router {
  const router = Router();

  router.post('/webhooks/github', async (req: Request, res: Response): Promise<void> => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!signature) {
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    const payload = req.body as Buffer;
    if (!payload || !verifySignature(payload.toString(), signature, secret)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const event = req.headers['x-github-event'] as string | undefined;
    if (event !== 'push') {
      res.status(200).json({ message: 'Event ignored', event });
      return;
    }

    try {
      await driver.sync();
      res.status(200).json({ message: 'Sync triggered' });
    } catch (err) {
      res.status(500).json({ error: 'Sync failed', message: (err as Error).message });
    }
  });

  return router;
}
