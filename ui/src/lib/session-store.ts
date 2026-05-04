import { randomBytes } from "crypto";

export interface SessionData {
  apiKey: string;
  workspaceId: string;
  csrfToken: string;
}

const sessions = new Map<string, SessionData>();

export function createSession(
  apiKey: string,
  workspaceId: string
): { sessionId: string; csrfToken: string } {
  const sessionId = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  sessions.set(sessionId, { apiKey, workspaceId, csrfToken });
  return { sessionId, csrfToken };
}

export function getSession(sessionId: string): SessionData | undefined {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}
