import { describe, it, expect } from "bun:test";
import { SchemaValidator } from "./schema-validator.js";
import { ValidationError } from "./errors.js";

describe("SchemaValidator", () => {
  describe("Plain JSON Schema validation", () => {
    it("should validate valid string", () => {
      const schema = { type: "string" };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate("hello")).toBe(true);
    });

    it("should reject invalid string", () => {
      const schema = { type: "string" };
      const validator = new SchemaValidator(schema);
      
      expect(() => validator.validate(123)).toThrow(ValidationError);
    });

    it("should validate valid object", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate({ name: "Alice", age: 30 })).toBe(true);
    });

    it("should reject object missing required field", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      };
      const validator = new SchemaValidator(schema);
      
      expect(() => validator.validate({})).toThrow(ValidationError);
    });

    it("should validate valid array", () => {
      const schema = {
        type: "array",
        items: { type: "string" },
      };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate(["a", "b", "c"])).toBe(true);
    });

    it("should reject array with wrong item type", () => {
      const schema = {
        type: "array",
        items: { type: "string" },
      };
      const validator = new SchemaValidator(schema);
      
      expect(() => validator.validate(["a", 123, "c"])).toThrow(ValidationError);
    });
  });

  describe("Co-Map validation (co-map)", () => {
    it("should validate valid co-map data", () => {
      const schema = {
        type: "co-map",
        properties: {
          name: { type: "string" },
          count: { type: "number" },
        },
      };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate({ name: "Test", count: 42 })).toBe(true);
    });

    it("should reject co-map with wrong property type", () => {
      const schema = {
        type: "co-map",
        properties: {
          name: { type: "string" },
        },
      };
      const validator = new SchemaValidator(schema);
      
      expect(() => validator.validate({ name: 123 })).toThrow(ValidationError);
    });
  });

  describe("Co-List validation (co-list)", () => {
    it("should validate valid co-list data", () => {
      const schema = {
        type: "co-list",
        items: { type: "string" },
      };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate(["a", "b", "c"])).toBe(true);
    });

    it("should reject co-list with wrong item type", () => {
      const schema = {
        type: "co-list",
        items: { type: "number" },
      };
      const validator = new SchemaValidator(schema);
      
      expect(() => validator.validate([1, "two", 3])).toThrow(ValidationError);
    });
  });

  describe("Co-ID validation (co-id)", () => {
    it("should validate valid co-id format", () => {
      const schema = { type: "co-id" };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate("co_z1abc123def")).toBe(true);
      expect(validator.validate("co_zXYZ_-789")).toBe(true);
    });

    it("should reject invalid co-id format", () => {
      const schema = { type: "co-id" };
      const validator = new SchemaValidator(schema);
      
      expect(() => validator.validate("invalid")).toThrow(ValidationError);
      expect(() => validator.validate("co_abc")).toThrow(ValidationError);  // Must start with co_z
      expect(() => validator.validate(123)).toThrow(ValidationError);
    });

    it("should validate co-id in object property", () => {
      const schema = {
        type: "co-map",
        properties: {
          author: { type: "co-id" },
        },
      };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate({ author: "co_z123abc" })).toBe(true);
    });
  });

  describe("Co-Stream validation (co-stream)", () => {
    it("should validate co-stream as array", () => {
      const schema = {
        type: "co-stream",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
          },
        },
      };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate([
        { text: "message 1" },
        { text: "message 2" },
      ])).toBe(true);
    });
  });

  describe("Nested schemas", () => {
    it("should validate nested co-* types", () => {
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
              required: ["text", "author"],
            },
          },
        },
      };
      const validator = new SchemaValidator(schema);
      
      expect(validator.validate({
        posts: [
          { text: "Post 1", author: "co_z123" },
          { text: "Post 2", author: "co_z456" },
        ],
      })).toBe(true);
    });

    it("should reject nested structure with invalid data", () => {
      const schema = {
        type: "co-map",
        properties: {
          posts: {
            type: "co-list",
            items: {
              type: "co-map",
              properties: {
                author: { type: "co-id" },
              },
              required: ["author"],
            },
          },
        },
      };
      const validator = new SchemaValidator(schema);
      
      // Missing required 'author' field
      expect(() => validator.validate({
        posts: [
          { text: "Post without author" },
        ],
      })).toThrow(ValidationError);
    });
  });

  describe("Validator caching", () => {
    it("should compile schema only once", () => {
      const schema = { type: "string" };
      const validator = new SchemaValidator(schema);
      
      // Multiple validations should use same compiled validator
      expect(validator.validate("test1")).toBe(true);
      expect(validator.validate("test2")).toBe(true);
      expect(validator.validate("test3")).toBe(true);
      
      // Should have single compiled validator
      expect(validator._validate).toBeDefined();
    });
  });

  describe("Error messages", () => {
    it("should provide clear error message for type mismatch", () => {
      const schema = { type: "string" };
      const validator = new SchemaValidator(schema);
      
      try {
        validator.validate(123);
        expect(true).toBe(false);  // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("must be string");
      }
    });

    it("should provide clear error for missing required field", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      };
      const validator = new SchemaValidator(schema);
      
      try {
        validator.validate({});
        expect(true).toBe(false);  // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("required");
      }
    });
  });
});
