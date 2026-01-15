/**
 * Schema Preprocessor - Converts co-* types to Ajv-compatible JSON Schema
 * 
 * Transforms custom co-* type notation into standard JSON Schema that Ajv can validate,
 * while preserving the original type information in x-co-type extension field.
 * 
 * Phase 1: Supports only the 7 core co-* types:
 * - co-map, co-list, co-stream, co-stream-binary
 * - co-account, co-group, co-plain-text
 * - co-id (reference type)
 * 
 * Phase 2 types (co-feed, co-vector, co-image) will throw an error.
 */

// Phase 1: Core types ONLY
const PHASE_1_TYPES = new Set([
  "co-map",
  "co-list",
  "co-stream",
  "co-binary",
  "co-account",
  "co-group",
  "co-plain-text",
  "co-id",
]);

// Phase 2: Higher abstractions (not yet supported)
const PHASE_2_TYPES = new Set([
  "co-feed",
  "co-vector",
  "co-image",
  "co-file",
  "co-rich-text",
]);

/**
 * Preprocess a JSON Schema, converting co-* types to Ajv-compatible format
 * @param {Object} schema - Original JSON Schema with co-* types
 * @returns {Object} Preprocessed schema compatible with Ajv
 */
export function preprocessSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  
  // Clone to avoid mutating original
  const processed = { ...schema };
  
  const type = processed.type;
  
  // Check for Phase 2 types (not yet supported)
  if (type && type.startsWith("co-") && PHASE_2_TYPES.has(type)) {
    throw new Error(
      `Unsupported co-* type: "${type}". This is a Phase 2 type. ` +
      `Phase 1 supports only: ${Array.from(PHASE_1_TYPES).join(", ")}`
    );
  }
  
  // Handle co-* types
  if (type && type.startsWith("co-")) {
    if (!PHASE_1_TYPES.has(type)) {
      throw new Error(
        `Unknown co-* type: "${type}". ` +
        `Supported types: ${Array.from(PHASE_1_TYPES).join(", ")}`
      );
    }
    
    // Store original co-type
    processed["x-co-type"] = type;
    
    // Convert to base JSON Schema type
    switch (type) {
      case "co-map":
      case "co-account":
      case "co-group":
      case "co-binary":
        processed.type = "object";
        break;
        
      case "co-list":
      case "co-stream":
        processed.type = "array";
        break;
        
      case "co-plain-text":
        processed.type = "string";
        break;
        
      case "co-id":
        processed.type = "string";
        // co-id must match pattern: co_z<base58>
        processed.pattern = "^co_z[a-zA-Z0-9_-]+$";
        break;
    }
  }
  
  // Recursively process nested schemas
  
  // Process properties (for objects/co-maps)
  if (processed.properties) {
    processed.properties = Object.fromEntries(
      Object.entries(processed.properties).map(([key, value]) => [
        key,
        preprocessSchema(value),
      ])
    );
  }
  
  // Process items (for arrays/co-lists/co-streams)
  if (processed.items) {
    processed.items = preprocessSchema(processed.items);
  }
  
  // Process additionalProperties
  if (processed.additionalProperties && typeof processed.additionalProperties === "object") {
    processed.additionalProperties = preprocessSchema(processed.additionalProperties);
  }
  
  // Process patternProperties
  if (processed.patternProperties) {
    processed.patternProperties = Object.fromEntries(
      Object.entries(processed.patternProperties).map(([pattern, value]) => [
        pattern,
        preprocessSchema(value),
      ])
    );
  }
  
  // Process anyOf, allOf, oneOf
  if (processed.anyOf) {
    processed.anyOf = processed.anyOf.map(preprocessSchema);
  }
  if (processed.allOf) {
    processed.allOf = processed.allOf.map(preprocessSchema);
  }
  if (processed.oneOf) {
    processed.oneOf = processed.oneOf.map(preprocessSchema);
  }
  
  return processed;
}
