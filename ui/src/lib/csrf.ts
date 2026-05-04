let clientCsrfToken: string | null = null;

export function setClientCsrfToken(token: string | null): void {
  clientCsrfToken = token;
}

export function getClientCsrfToken(): string | null {
  return clientCsrfToken;
}

export function clearCsrfToken(): void {
  clientCsrfToken = null;
}
