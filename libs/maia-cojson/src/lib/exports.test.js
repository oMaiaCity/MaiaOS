import { describe, it, expect } from "bun:test";
import { coValuesCache, CoValueLoadingState } from "../index.js";

describe("Library Exports", () => {
  it("should export coValuesCache from main index", () => {
    expect(coValuesCache).toBeDefined();
    expect(typeof coValuesCache.get).toBe("function");
  });

  it("should export CoValueLoadingState from main index", () => {
    expect(CoValueLoadingState).toBeDefined();
    expect(CoValueLoadingState.LOADING).toBe("loading");
    expect(CoValueLoadingState.LOADED).toBe("loaded");
    expect(CoValueLoadingState.UNAVAILABLE).toBe("unavailable");
  });
});
