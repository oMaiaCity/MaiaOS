import { describe, it, expect } from "bun:test";
import { createAccount } from "./oID.js";
import { createBinaryStream } from "./oBinary.js";
import { hasSchema } from "../utils/meta.js";

describe("oBinary service", () => {
  it("should create a BinaryCoStream with schema in headerMeta", async () => {
    const { group } = await createAccount({ name: "Test" });

    const binaryStream = createBinaryStream(group, "ImageStreamSchema");

    expect(binaryStream).toBeDefined();
    expect(binaryStream.id).toBeDefined();
    expect(binaryStream.id.startsWith("co_")).toBe(true);
    expect(binaryStream.headerMeta).toEqual({ $schema: "ImageStreamSchema" });
    expect(hasSchema(binaryStream, "ImageStreamSchema")).toBe(true);
  });

  it("should create a BinaryCoStream with default {type: 'binary'} when no schema", async () => {
    const { group } = await createAccount({ name: "Test" });

    const binaryStream = createBinaryStream(group, null);

    expect(binaryStream.headerMeta).toEqual({ type: "binary" });
  });

  it("should support pushing binary chunks", async () => {
    const { group } = await createAccount({ name: "Test" });

    const binaryStream = createBinaryStream(group, "FileStreamSchema");

    // Push binary data (Uint8Array)
    const chunk1 = new Uint8Array([1, 2, 3, 4]);
    const chunk2 = new Uint8Array([5, 6, 7, 8]);
    
    binaryStream.push(chunk1);
    binaryStream.push(chunk2);

    // Verify schema is preserved after operations
    expect(hasSchema(binaryStream, "FileStreamSchema")).toBe(true);
    expect(binaryStream.headerMeta).toEqual({ $schema: "FileStreamSchema" });
  });
});
