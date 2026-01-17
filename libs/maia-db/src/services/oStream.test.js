import { describe, it, expect } from "bun:test";
import { createAccount } from "./oID.js";
import { createCoStream } from "./oStream.js";
import { hasSchema } from "../utils/meta.js";

describe("oStream service", () => {
  it("should create a CoStream with schema in headerMeta", async () => {
    const { group } = await createAccount({ name: "Test" });

    const stream = createCoStream(group, "MessageStreamSchema");

    expect(stream).toBeDefined();
    expect(stream.id).toBeDefined();
    expect(stream.id.startsWith("co_")).toBe(true);
    expect(stream.headerMeta).toEqual({ $schema: "MessageStreamSchema" });
    expect(hasSchema(stream, "MessageStreamSchema")).toBe(true);
  });

  it("should create a CoStream with no schema (null headerMeta)", async () => {
    const { group } = await createAccount({ name: "Test" });

    const stream = createCoStream(group, null);

    expect(stream.headerMeta).toBeNull();
  });

  it("should support pushing items to the stream", async () => {
    const { group } = await createAccount({ name: "Test" });

    const stream = createCoStream(group, "EventStreamSchema");

    // Push some items
    stream.push("event1");
    stream.push("event2");

    // Verify schema is preserved after operations
    expect(hasSchema(stream, "EventStreamSchema")).toBe(true);
    expect(stream.headerMeta).toEqual({ $schema: "EventStreamSchema" });
  });
});
