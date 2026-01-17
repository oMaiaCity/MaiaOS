import { describe, it, expect } from "bun:test";
import { createAccount } from "./oID.js";
import { createPlainText } from "./oPlainText.js";
import { hasSchema } from "../utils/meta.js";

describe("oPlainText service", () => {
  it("should create a CoPlainText with schema in headerMeta", async () => {
    const { group } = await createAccount({ name: "Test" });

    const plaintext = createPlainText(group, "Hello World", "DocumentSchema");

    expect(plaintext).toBeDefined();
    expect(plaintext.id).toBeDefined();
    expect(plaintext.id.startsWith("co_")).toBe(true);
    expect(plaintext.headerMeta).toEqual({ $schema: "DocumentSchema" });
    expect(hasSchema(plaintext, "DocumentSchema")).toBe(true);
  });

  it("should create a CoPlainText with no schema (null headerMeta)", async () => {
    const { group } = await createAccount({ name: "Test" });

    const plaintext = createPlainText(group, "Some text", null);

    expect(plaintext.headerMeta).toBeNull();
  });

  it("should create a CoPlainText with initial text content", async () => {
    const { group } = await createAccount({ name: "Test" });

    const plaintext = createPlainText(group, "Hello World", "NoteSchema");

    // toJSON() returns array of characters, use toString() for string
    expect(plaintext.toString()).toBe("Hello World");
    expect(hasSchema(plaintext, "NoteSchema")).toBe(true);
  });

  it("should support text editing operations", async () => {
    const { group } = await createAccount({ name: "Test" });

    const plaintext = createPlainText(group, "Hello", "TextSchema");

    // Append text
    plaintext.append(" World");

    // Use toString() for string representation
    expect(plaintext.toString()).toBe("Hello World");
    expect(hasSchema(plaintext, "TextSchema")).toBe(true);
  });
});
