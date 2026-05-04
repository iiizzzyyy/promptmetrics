import { z } from 'zod';

export const playgroundChatRequestSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().min(1, 'Model is required'),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ).min(1, 'At least one message is required'),
  variables: z.record(z.string(), z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).optional(),
  topP: z.number().min(0).max(1).optional(),
  jsonMode: z.boolean().optional(),
  timeoutMs: z.number().int().min(1000).max(300000).optional(),
}).refine(
  (data) => data.messages.some((m) => m.content.trim().length > 0),
  { message: 'At least one message must have content', path: ['messages'] }
);

export type PlaygroundChatRequest = z.infer<typeof playgroundChatRequestSchema>;
