import 'express';

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        name: string;
        scopes: string[];
        workspace_id?: string;
      };
      requestId?: string;
      workspaceId?: string;
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
