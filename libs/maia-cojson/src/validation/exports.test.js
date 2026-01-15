import { describe, it, expect } from "bun:test";
import {
  SchemaValidator,
  preprocessSchema,
  ValidationError,
} from "../index.js";

describe("Validation Exports from Main Index", () => {
  it("should export SchemaValidator", () => {
    expect(SchemaValidator).toBeDefined();
    expect(typeof SchemaValidator).toBe("function");
  });

  it("should export preprocessSchema", () => {
    expect(preprocessSchema).toBeDefined();
    expect(typeof preprocessSchema).toBe("function");
  });

  it("should export ValidationError", () => {
    expect(ValidationError).toBeDefined();
    expect(typeof ValidationError).toBe("function");
  });

  it("should create working SchemaValidator from exports", () => {
    const validator = new SchemaValidator({ type: "string" });
    expect(validator.validate("test")).toBe(true);
  });

  it("should throw ValidationError from exports", () => {
    const validator = new SchemaValidator({ type: "string" });
    
    try {
      validator.validate(123);
      expect(true).toBe(false);  // Should not reach
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});
