/**
 * MetaSchema Definition
 * 
 * Self-referencing meta-schema based on JSON Schema 2020 with x-co-* extensions
 */

export const META_SCHEMA_DEFINITION = {
  // NOTE: $schema and $id are added during bootstrap (calculated from co-id)
  "title": "MaiaCojson MetaSchema",
  "description": "Self-referencing meta-schema for validating all schemas in the system",
  "type": "co-map",
  
  "properties": {
    // JSON Schema 2020 base properties (adapted for CoMaps)
    "$schema": { 
      "type": "co-id",
      "description": "Reference to the meta-schema that validates this schema (self-referencing for MetaSchema)"
    },
    "$id": { 
      "type": "string",
      "description": "Unique identifier for this schema"
    },
    "title": {
      "type": "string",
      "description": "Human-readable title for this schema"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description for this schema"
    },
    "type": { 
      "type": "string",
      "enum": [
        "co-map", "co-list", "co-stream", "co-binary",
        "string", "number", "boolean", "integer",
        "object", "array", "null"
      ],
      "description": "The type of this schema (CRDT or JSON Schema primitive)"
    },
    "properties": { 
      "type": "object",
      "description": "Property definitions for co-map/object types"
    },
    "items": {
      "type": "object",
      "description": "Item schema for co-list/array types"
    },
    "required": { 
      "type": "array",
      "items": { "type": "string" },
      "description": "Required property names"
    },
    "enum": {
      "type": "array",
      "description": "Enumerated allowed values"
    },
    "const": {
      "description": "Constant value"
    },
    "minimum": {
      "type": "number",
      "description": "Minimum value for numbers"
    },
    "maximum": {
      "type": "number",
      "description": "Maximum value for numbers"
    },
    "minLength": {
      "type": "integer",
      "description": "Minimum string length"
    },
    "maxLength": {
      "type": "integer",
      "description": "Maximum string length"
    },
    "pattern": {
      "type": "string",
      "description": "Regular expression pattern for strings"
    },
    
    // x-co-* extensions for CRDT types
    "name": {
      "type": "string",
      "description": "Schema name"
    },
    "definition": {
      "type": "object",
      "description": "Direct JSON schema definition (not stringified, not nested CoMaps)"
    },
    "x-co-schema": {
      "type": "co-id", 
      "description": "Explicit schema reference for co-id properties (enables schema reuse)"
    }
  },
  
  "required": ["type"]
};
