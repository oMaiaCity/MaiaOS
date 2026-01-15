import { describe, it, expect } from "bun:test";
import { CoValueLoadingState } from "./loading-states.js";

describe("CoValueLoadingState", () => {
  it("should define LOADING state", () => {
    expect(CoValueLoadingState.LOADING).toBe("loading");
  });

  it("should define LOADED state", () => {
    expect(CoValueLoadingState.LOADED).toBe("loaded");
  });

  it("should define UNAVAILABLE state", () => {
    expect(CoValueLoadingState.UNAVAILABLE).toBe("unavailable");
  });

  it("should have exactly 3 states", () => {
    const states = Object.keys(CoValueLoadingState);
    expect(states.length).toBe(3);
    expect(states).toEqual(["LOADING", "LOADED", "UNAVAILABLE"]);
  });

  it("should be immutable (frozen)", () => {
    expect(Object.isFrozen(CoValueLoadingState)).toBe(true);
  });

  it("should have string values", () => {
    expect(typeof CoValueLoadingState.LOADING).toBe("string");
    expect(typeof CoValueLoadingState.LOADED).toBe("string");
    expect(typeof CoValueLoadingState.UNAVAILABLE).toBe("string");
  });
});
