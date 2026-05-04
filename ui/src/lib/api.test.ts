import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "./api";
import { setClientCsrfToken, clearCsrfToken } from "./csrf";

describe("api client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 }),
    } as Response);

    clearCsrfToken();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearCsrfToken();
  });

  it("does not send X-API-Key or X-Workspace-Id from client", async () => {
    await api.getPrompts({ page: 1, limit: 20 });

    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(headers["X-API-Key"]).toBeUndefined();
    expect(headers["X-Workspace-Id"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("includes X-CSRF-Token on mutating requests when token is set", async () => {
    setClientCsrfToken("test-csrf");
    await api.createEvaluation({
      name: "test",
      prompt_name: "test-prompt",
    });

    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(headers["X-CSRF-Token"]).toBe("test-csrf");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does not include X-CSRF-Token on GET requests", async () => {
    setClientCsrfToken("test-csrf");
    await api.getPrompts();

    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("does not include X-CSRF-Token when not set", async () => {
    await api.createEvaluation({
      name: "test",
      prompt_name: "test-prompt",
    });

    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("throws ApiError with status, statusText, and parsed body on failure", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({ error: "Invalid input" }),
    } as Response);

    try {
      await api.getPrompts();
      expect.fail("Expected ApiError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(422);
      expect((err as ApiError).statusText).toBe("Unprocessable Entity");
      expect((err as ApiError).body).toEqual({ error: "Invalid input" });
    }
  });

  it("includes AbortSignal.timeout in fetch calls", async () => {
    await api.getPrompts();

    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;

    expect(init.signal).toBeDefined();
  });
});
