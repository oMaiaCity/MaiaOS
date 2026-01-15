import { describe, it, expect } from "bun:test";
import {
  CoMap,
  CoList,
  CoStream,
  CoBinary,
  Account,
  Group,
  CoPlainText,
} from "../index.js";

describe("Wrapper Exports from Main Index", () => {
  it("should export CoMap", () => {
    expect(CoMap).toBeDefined();
    expect(typeof CoMap.fromRaw).toBe("function");
  });

  it("should export CoList", () => {
    expect(CoList).toBeDefined();
    expect(typeof CoList.fromRaw).toBe("function");
  });

  it("should export CoStream", () => {
    expect(CoStream).toBeDefined();
    expect(typeof CoStream.fromRaw).toBe("function");
  });

  it("should export CoBinary", () => {
    expect(CoBinary).toBeDefined();
    expect(typeof CoBinary.fromRaw).toBe("function");
  });

  it("should export Account", () => {
    expect(Account).toBeDefined();
    expect(typeof Account.fromRaw).toBe("function");
  });

  it("should export Group", () => {
    expect(Group).toBeDefined();
    expect(typeof Group.fromRaw).toBe("function");
  });

  it("should export CoPlainText", () => {
    expect(CoPlainText).toBeDefined();
    expect(typeof CoPlainText.fromRaw).toBe("function");
  });
});
