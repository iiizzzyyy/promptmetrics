import { describe, it, expect } from "vitest";
import { usePlaygroundStore } from "./playground.store";

describe("playground store", () => {
  it("uses streamTokens array for O(1) appends", () => {
    const store = usePlaygroundStore.getState();
    expect(store.streamTokens).toEqual([]);

    store.appendStreamToken("hello");
    store.appendStreamToken(" world");

    expect(usePlaygroundStore.getState().streamTokens).toEqual([
      "hello",
      " world",
    ]);
  });

  it("resets stream tokens on resetStream", () => {
    const store = usePlaygroundStore.getState();
    store.appendStreamToken("test");
    store.setStreamError("error");
    store.setRunMetrics({ tokensIn: 1, tokensOut: 2, latencyMs: 3, costUsd: 4 });

    store.resetStream();

    const state = usePlaygroundStore.getState();
    expect(state.streamTokens).toEqual([]);
    expect(state.streamError).toBeNull();
    expect(state.runMetrics).toBeNull();
  });
});
