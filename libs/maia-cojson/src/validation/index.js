/**
 * Validation Module (Phase 1: Milestone 3)
 * 
 * JSON Schema validation with co-* type support using Ajv.
 * 
 * Exports:
 * - SchemaValidator: Main validator class
 * - preprocessSchema: Schema preprocessing utility
 * - ValidationError: Custom error class
 * 
 * @example
 * ```js
 * import { SchemaValidator } from "maia-cojson";
 * 
 * const validator = new SchemaValidator({
 *   type: "co-map",
 *   properties: {
 *     name: { type: "string" },
 *   },
 * });
 * 
 * validator.validate({ name: "Test" });  // ✅
 * ```
 */

export { SchemaValidator } from "./schema-validator.js";
export { preprocessSchema } from "./schema-preprocessor.js";
export { ValidationError } from "./errors.js";
