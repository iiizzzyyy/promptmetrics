import 'express';

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        name: string;
        scopes: string[];
      };
      requestId?: string;
    }
  }
}

export {};
