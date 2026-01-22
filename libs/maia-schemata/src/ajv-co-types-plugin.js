/**
 * AJV Plugin for CoJSON Types
 * 
 * Adds support for:
 * - `cotype` keyword: Validates CoJSON CRDT types (comap, colist, costream) at schema root
 * - `$co` keyword: Macro for co-id references in properties/items
 * 
 * CoText is modeled as colist with string items (not a separate schema type).
 * ZERO transformation - direct validation (storage format = validation format)
 */

/**
 * Register CoJSON type keywords with AJV
 * @param {import('ajv').default} ajv - AJV instance
 */
export function ajvCoTypesPlugin(ajv) {
  // Add $co keyword as macro - expands to co-id string validation
  ajv.addKeyword({
    keyword: "$co",
    macro: (schemaCoId) => ({
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      _schemaRef: schemaCoId  // Store schema co-id for metadata
    }),
    metaSchema: {
      type: "string",
      anyOf: [
        {
          pattern: "^co_z[a-zA-Z0-9]+$",
          description: "Co-id reference (after transformation)"
        },
        {
          pattern: "^@schema/",
          description: "Human-readable schema ID (before transformation)"
        }
      ],
      description: "Reference to schema that this property value must conform to (human-readable ID or co-id)"
    }
  })
  
  // Add cotype keyword - validates CRDT type at schema root only
  // For colist/costream, instances can be either:
  // 1. Direct arrays (raw CRDT structure)
  // 2. Objects with an 'items' property (wrapped with metadata like $schema, $id)
  ajv.addKeyword({
    keyword: 'cotype',
    validate: (schema, data) => {
      if (schema === 'comap') {
        return typeof data === 'object' && !Array.isArray(data) && data !== null
      }
      if (schema === 'colist' || schema === 'costream') {
        // Direct array (raw CRDT structure)
        if (Array.isArray(data)) {
          return true
        }
        // Object with 'items' property (wrapped instance with metadata)
        if (typeof data === 'object' && data !== null && Array.isArray(data.items)) {
          return true
        }
        return false
      }
      return false
    },
    metaSchema: {
      enum: ["comap", "colist", "costream"]
    }
  })
}
