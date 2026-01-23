/**
 * Meta Schema - JSON Schema 2020-12 meta schema with embedded co-type $defs
 * 
 * This meta schema validates all other schemas in the system.
 * It includes embedded $defs for co-types (comap, colist, costream, cotext)
 * and enforces that schema CoMaps are root type `co-map` with `definition` property.
 * 
 * The meta schema will self-reference via $schema once it's created as a CoValue.
 * During creation, $schema will be set to: "https://maia.city/{metaSchemaCoId}"
 */

// Import co-type definitions to embed in meta schema
import coTypesDefs from './co-types.defs.json';

/**
 * Get the JSON Schema 2020-12 meta schema with embedded co-type $defs
 * 
 * This meta schema:
 * - Validates schema CoMaps (must be root type `co-map` with `definition` property)
 * - Includes embedded $defs for co-types (comap, colist, costream, cotext)
 * - Enforces that schema definitions use standard JSON Schema structure (objects/arrays)
 * - Will self-reference via $schema once created as CoValue
 * 
 * @param {string} metaSchemaCoId - The co-id of the meta schema CoMap (for self-reference)
 * @returns {Object} Meta schema definition
 */
export function getMetaSchemaDefinition(metaSchemaCoId = null) {
  const metaSchemaId = metaSchemaCoId 
    ? `https://maia.city/${metaSchemaCoId}` 
    : 'https://json-schema.org/draft/2020-12/schema'; // Fallback during creation
  
  // JSON Schema Draft 2020-12 meta-schema with embedded co-type $defs
  return {
    $schema: metaSchemaId, // Self-reference (will be set to co-id URI once created)
    $id: metaSchemaId,
    $vocabulary: {
      'https://json-schema.org/draft/2020-12/vocab/core': true,
      'https://json-schema.org/draft/2020-12/vocab/applicator': true,
      'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
      'https://json-schema.org/draft/2020-12/vocab/validation': true,
      'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
      'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
      'https://json-schema.org/draft/2020-12/vocab/content': true
    },
    $dynamicAnchor: 'meta',
    title: 'Meta Schema',
    description: 'JSON Schema 2020-12 meta schema with embedded co-type definitions for MaiaOS',
    type: ['object', 'boolean'],
    properties: {
      $id: {
        type: 'string',
        format: 'uri-reference',
        pattern: '^[^#]*#?$'
      },
      $schema: {
        type: 'string',
        format: 'uri-reference'
      },
      $anchor: {
        type: 'string',
        pattern: '^[A-Za-z][-A-Za-z0-9.:_]*$'
      },
      $ref: {
        type: 'string',
        format: 'uri-reference'
      },
      $dynamicRef: {
        type: 'string',
        format: 'uri-reference'
      },
      $dynamicAnchor: {
        type: 'string',
        pattern: '^[A-Za-z][-A-Za-z0-9.:_]*$'
      },
      $vocabulary: {
        type: 'object',
        patternProperties: {
          '^[^#]*#?$': {
            type: 'boolean'
          }
        },
        additionalProperties: false
      },
      $comment: {
        type: 'string'
      },
      $defs: {
        type: 'object',
        additionalProperties: { $dynamicRef: '#meta' },
        default: {}
      },
      type: {
        anyOf: [
          { $ref: '#/$defs/simpleTypes' },
          {
            type: 'array',
            items: { $ref: '#/$defs/simpleTypes' },
            minItems: 1,
            uniqueItems: true
          }
        ]
      },
      const: true,
      enum: {
        type: 'array',
        items: true
      },
      multipleOf: {
        type: 'number',
        exclusiveMinimum: 0
      },
      maximum: { type: 'number' },
      exclusiveMaximum: { type: 'number' },
      minimum: { type: 'number' },
      exclusiveMinimum: { type: 'number' },
      maxLength: { $ref: '#/$defs/nonNegativeInteger' },
      minLength: { $ref: '#/$defs/nonNegativeIntegerDefault0' },
      pattern: {
        type: 'string',
        format: 'regex'
      },
      maxItems: { $ref: '#/$defs/nonNegativeInteger' },
      minItems: { $ref: '#/$defs/nonNegativeIntegerDefault0' },
      uniqueItems: {
        type: 'boolean',
        default: false
      },
      maxContains: { $ref: '#/$defs/nonNegativeInteger' },
      minContains: {
        $ref: '#/$defs/nonNegativeInteger',
        default: 1
      },
      maxProperties: { $ref: '#/$defs/nonNegativeInteger' },
      minProperties: { $ref: '#/$defs/nonNegativeIntegerDefault0' },
      required: { $ref: '#/$defs/stringArray' },
      dependentRequired: {
        type: 'object',
        additionalProperties: {
          $ref: '#/$defs/stringArray'
        }
      },
      properties: {
        type: 'object',
        additionalProperties: { $dynamicRef: '#meta' },
        default: {}
      },
      patternProperties: {
        type: 'object',
        additionalProperties: { $dynamicRef: '#meta' },
        propertyNames: { format: 'regex' },
        default: {}
      },
      additionalProperties: { $dynamicRef: '#meta' },
      propertyNames: { $dynamicRef: '#meta' },
      unevaluatedItems: { $dynamicRef: '#meta' },
      unevaluatedProperties: { $dynamicRef: '#meta' },
      items: { $dynamicRef: '#meta' },
      prefixItems: {
        $ref: '#/$defs/schemaArray'
      },
      contains: { $dynamicRef: '#meta' },
      allOf: {
        $ref: '#/$defs/schemaArray'
      },
      anyOf: {
        $ref: '#/$defs/schemaArray'
      },
      oneOf: {
        $ref: '#/$defs/schemaArray'
      },
      not: { $dynamicRef: '#meta' },
      if: { $dynamicRef: '#meta' },
      then: { $dynamicRef: '#meta' },
      else: { $dynamicRef: '#meta' },
      format: { type: 'string' },
      contentEncoding: { type: 'string' },
      contentMediaType: { type: 'string' },
      contentSchema: { $dynamicRef: '#meta' },
      title: { type: 'string' },
      description: { type: 'string' },
      default: true,
      deprecated: {
        type: 'boolean',
        default: false
      },
      readOnly: {
        type: 'boolean',
        default: false
      },
      writeOnly: {
        type: 'boolean',
        default: false
      },
      examples: {
        type: 'array',
        items: true
      }
    },
    $defs: {
      // Standard JSON Schema 2020-12 $defs
      nonNegativeInteger: {
        type: 'integer',
        minimum: 0
      },
      nonNegativeIntegerDefault0: {
        $ref: '#/$defs/nonNegativeInteger',
        default: 0
      },
      simpleTypes: {
        enum: [
          'array',
          'boolean',
          'integer',
          'null',
          'number',
          'object',
          'string'
        ]
      },
      stringArray: {
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true,
        default: []
      },
      schemaArray: {
        type: 'array',
        minItems: 1,
        items: { $dynamicRef: '#meta' }
      },
      // Embedded co-type definitions for MaiaOS
      ...coTypesDefs.$defs
    }
  };
}

/**
 * Get meta schema definition for creating as CoMap
 * This wraps the meta schema in a `definition` property structure
 * 
 * @param {string} metaSchemaCoId - The co-id of the meta schema CoMap
 * @returns {Object} Schema CoMap structure with definition property
 */
export function getMetaSchemaCoMapDefinition(metaSchemaCoId) {
  return {
    definition: getMetaSchemaDefinition(metaSchemaCoId)
  };
}
