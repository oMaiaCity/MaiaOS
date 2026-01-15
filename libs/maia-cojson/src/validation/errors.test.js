import { describe, it, expect } from "bun:test";
import { ValidationError } from "./errors.js";

describe("ValidationError", () => {
  it("should create error with message from Ajv errors", () => {
    const ajvErrors = [
      {
        instancePath: "/name",
        schemaPath: "#/properties/name/type",
        keyword: "type",
        params: { type: "string" },
        message: "must be string",
      },
    ];
    
    const error = new ValidationError(ajvErrors, { type: "object" });
    
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ValidationError");
    expect(error.message).toContain("must be string");
  });

  it("should format multiple errors", () => {
    const ajvErrors = [
      {
        instancePath: "/name",
        keyword: "type",
        message: "must be string",
      },
      {
        instancePath: "/age",
        keyword: "type",
        message: "must be number",
      },
    ];
    
    const error = new ValidationError(ajvErrors, {});
    
    expect(error.message).toContain("must be string");
    expect(error.message).toContain("must be number");
  });

  it("should expose ajvErrors property", () => {
    const ajvErrors = [
      {
        instancePath: "/test",
        keyword: "type",
        message: "must be string",
      },
    ];
    
    const error = new ValidationError(ajvErrors, {});
    
    expect(error.ajvErrors).toBe(ajvErrors);
  });

  it("should expose originalSchema property", () => {
    const schema = { type: "string" };
    const error = new ValidationError([], schema);
    
    expect(error.originalSchema).toBe(schema);
  });

  it("should handle errors at root path", () => {
    const ajvErrors = [
      {
        instancePath: "",
        keyword: "type",
        message: "must be object",
      },
    ];
    
    const error = new ValidationError(ajvErrors, {});
    
    expect(error.message).toContain("must be object");
  });
});
