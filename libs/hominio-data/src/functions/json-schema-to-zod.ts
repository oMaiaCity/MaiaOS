/**
 * Utility to convert JSON Schema to Jazz Zod schemas
 * Supports basic types: string, number, boolean, array, object
 */

import { z } from "jazz-tools";

/**
 * Converts a JSON Schema property definition to a Zod schema
 * 
 * @param propertySchema - JSON Schema property definition
 * @returns Zod schema equivalent
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonSchemaToZod(propertySchema: any): any {
  if (!propertySchema || typeof propertySchema !== "object") {
    return z.string(); // Default to string for unknown types
  }

  const type = propertySchema.type;

  switch (type) {
    case "string":
      return z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      // For arrays, try to get items schema
      if (propertySchema.items) {
        return z.array(jsonSchemaToZod(propertySchema.items));
      }
      return z.array(z.string()); // Default array of strings
    case "object":
      // For nested objects, create a passthrough object
      if (propertySchema.properties) {
        const shape: Record<string, any> = {};
        for (const [key, value] of Object.entries(propertySchema.properties)) {
          shape[key] = jsonSchemaToZod(value as any);
        }
        return z.object(shape).passthrough();
      }
      return z.object({}).passthrough();
    default:
      return z.string(); // Default to string for unknown types
  }
}

/**
 * Creates a Zod object schema from a JSON Schema definition
 * 
 * @param jsonSchema - Complete JSON Schema object definition
 * @returns Zod object schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonSchemaToZodObject(jsonSchema: any): any {
  if (!jsonSchema || jsonSchema.type !== "object") {
    throw new Error("JSON Schema must be an object type");
  }

  if (!jsonSchema.properties) {
    return z.object({});
  }

  const shape: Record<string, any> = {};
  for (const [key, value] of Object.entries(jsonSchema.properties)) {
    shape[key] = jsonSchemaToZod(value as any);
  }

  return z.object(shape);
}

