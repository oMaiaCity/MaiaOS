import { describe, it, expect } from "bun:test";
import { preprocessSchema } from "./schema-preprocessor.js";

describe("Schema Preprocessor", () => {
  describe("Plain JSON Schema types", () => {
    it("should pass through string type unchanged", () => {
      const schema = { type: "string" };
      const result = preprocessSchema(schema);
      
      expect(result).toEqual({ type: "string" });
    });

    it("should pass through number type unchanged", () => {
      const schema = { type: "number" };
      const result = preprocessSchema(schema);
      
      expect(result).toEqual({ type: "number" });
    });

    it("should pass through object type unchanged", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };
      const result = preprocessSchema(schema);
      
      expect(result).toEqual(schema);
    });

    it("should pass through array type unchanged", () => {
      const schema = {
        type: "array",
        items: { type: "string" },
      };
      const result = preprocessSchema(schema);
      
      expect(result).toEqual(schema);
    });
  });

  describe("Co-* type preprocessing (Phase 1 - Core 7 types)", () => {
    it("should preprocess co-map to object with x-co-type", () => {
      const schema = {
        type: "co-map",
        properties: {
          name: { type: "string" },
        },
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("object");
      expect(result["x-co-type"]).toBe("co-map");
      expect(result.properties).toEqual({
        name: { type: "string" },
      });
    });

    it("should preprocess co-list to array with x-co-type", () => {
      const schema = {
        type: "co-list",
        items: { type: "string" },
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("array");
      expect(result["x-co-type"]).toBe("co-list");
      expect(result.items).toEqual({ type: "string" });
    });

    it("should preprocess co-stream to array with x-co-type", () => {
      const schema = {
        type: "co-stream",
        items: { type: "object" },
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("array");
      expect(result["x-co-type"]).toBe("co-stream");
      expect(result.items).toEqual({ type: "object" });
    });

    it("should preprocess co-binary with x-co-type", () => {
      const schema = {
        type: "co-binary",
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("object");
      expect(result["x-co-type"]).toBe("co-binary");
    });

    it("should preprocess co-account with x-co-type", () => {
      const schema = {
        type: "co-account",
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("object");
      expect(result["x-co-type"]).toBe("co-account");
    });

    it("should preprocess co-group with x-co-type", () => {
      const schema = {
        type: "co-group",
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("object");
      expect(result["x-co-type"]).toBe("co-group");
    });

    it("should preprocess co-plain-text with x-co-type", () => {
      const schema = {
        type: "co-plain-text",
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("string");
      expect(result["x-co-type"]).toBe("co-plain-text");
    });
  });

  describe("Co-ID references", () => {
    it("should preprocess co-id to string with pattern", () => {
      const schema = {
        type: "co-id",
      };
      const result = preprocessSchema(schema);
      
      expect(result.type).toBe("string");
      expect(result.pattern).toBe("^co_z[a-zA-Z0-9_-]+$");
      expect(result["x-co-type"]).toBe("co-id");
    });

    it("should handle co-id in object properties", () => {
      const schema = {
        type: "co-map",
        properties: {
          author: { type: "co-id" },
        },
      };
      const result = preprocessSchema(schema);
      
      expect(result.properties.author.type).toBe("string");
      expect(result.properties.author.pattern).toBe("^co_z[a-zA-Z0-9_-]+$");
      expect(result.properties.author["x-co-type"]).toBe("co-id");
    });
  });

  describe("Nested schemas", () => {
    it("should recursively preprocess nested co-* types", () => {
      const schema = {
        type: "co-map",
        properties: {
          posts: {
            type: "co-list",
            items: {
              type: "co-map",
              properties: {
                text: { type: "string" },
                author: { type: "co-id" },
              },
            },
          },
        },
      };
      const result = preprocessSchema(schema);
      
      // Root co-map
      expect(result.type).toBe("object");
      expect(result["x-co-type"]).toBe("co-map");
      
      // Nested co-list
      expect(result.properties.posts.type).toBe("array");
      expect(result.properties.posts["x-co-type"]).toBe("co-list");
      
      // Nested co-map in list items
      expect(result.properties.posts.items.type).toBe("object");
      expect(result.properties.posts.items["x-co-type"]).toBe("co-map");
      
      // Co-id reference
      expect(result.properties.posts.items.properties.author.type).toBe("string");
      expect(result.properties.posts.items.properties.author["x-co-type"]).toBe("co-id");
    });
  });

  describe("Phase 2 types (should NOT be supported)", () => {
    it("should throw error for co-feed (Phase 2 type)", () => {
      const schema = { type: "co-feed" };
      
      expect(() => preprocessSchema(schema)).toThrow("Unsupported co-* type");
    });

    it("should throw error for co-vector (Phase 2 type)", () => {
      const schema = { type: "co-vector" };
      
      expect(() => preprocessSchema(schema)).toThrow("Unsupported co-* type");
    });

    it("should throw error for co-image (Phase 2 type)", () => {
      const schema = { type: "co-image" };
      
      expect(() => preprocessSchema(schema)).toThrow("Unsupported co-* type");
    });
  });
});
