/**
 * Schema Registry - JSON Schema definitions for MaiaDB
 * 
 * Contains hardcoded schemas ONLY for migrations and seeding (before account.os.schemata exists).
 * All runtime schema access MUST load from account.os.schemata CoList.
 * 
 * NO FALLBACKS - 100% migration to CoValue-based schemas.
 */

import coTypesDefs from './co-types.defs.json';
import { getMetaSchemaDefinition } from './meta-schema.js';

/**
 * AccountSchema - CoMap schema for account CoValues
 * Accounts have special properties: sealer, signer, readKey, profile, examples
 */
const AccountSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/AccountSchema",
  title: "Account",
  description: "Schema for account CoMap (special CoMap with authentication properties)",
  allOf: [
    { $ref: "#/$defs/comap" }
  ],
  properties: {
    sealer: {
      type: "string",
      pattern: "^sealer_",
      description: "Sealer key for encryption"
    },
    signer: {
      type: "string",
      pattern: "^signer_",
      description: "Signer key for signing"
    },
    readKey: {
      type: "string",
      description: "Read key for decryption"
    },
    profile: {
      allOf: [
        {
          type: "string",
          pattern: "^co_z[a-zA-Z0-9]+$",
          description: "Co-id reference to Profile CoMap"
        },
        {
          $ref: "https://maia.city/ProfileSchema"
        }
      ]
    },
    examples: {
      allOf: [
        {
          type: "string",
          pattern: "^co_z[a-zA-Z0-9]+$",
          description: "Co-id reference to Examples CoMap"
        },
        {
          $ref: "https://maia.city/ExamplesSchema"
        }
      ]
    }
  },
  required: ["profile"],
  $defs: coTypesDefs.$defs
};

/**
 * GroupSchema - CoMap schema for group CoValues
 * Groups have members and permissions
 */
const GroupSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/GroupSchema",
  title: "Group",
  description: "Schema for group CoMap (special CoMap with member management)",
  allOf: [
    { $ref: "#/$defs/comap" }
  ],
  properties: {
    // Groups can have members (co-ids) and permissions
    // Structure depends on cojson's group implementation
  },
  $defs: coTypesDefs.$defs
};

/**
 * ProfileSchema - CoMap schema for profile CoValues
 */
const ProfileSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/ProfileSchema",
  title: "Profile",
  description: "Schema for profile CoMap",
  allOf: [
    { $ref: "#/$defs/comap" }
  ],
  properties: {
    name: {
      type: "string",
      minLength: 1,
      description: "User's display name"
    }
  },
  required: ["name"],
  $defs: coTypesDefs.$defs
};

/**
 * ExamplesSchema - CoMap schema for examples container
 * Contains references to example CoValues: plainText, stream, notes
 */
const ExamplesSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/ExamplesSchema",
  title: "Examples",
  description: "Schema for examples container CoMap",
  allOf: [
    { $ref: "#/$defs/comap" }
  ],
  properties: {
    plainText: {
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      description: "Co-id reference to CoText example (cotext type)"
    },
    stream: {
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      description: "Co-id reference to CoStream example (costream type)"
    },
    notes: {
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      description: "Co-id reference to CoList example (colist type)"
    },
    pureJson: {
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      description: "Co-id reference to PureJsonSchema CoMap (comap type)"
    }
  },
  $defs: coTypesDefs.$defs
};

/**
 * ActivityStreamSchema - CoStream schema for activity streams
 */
const ActivityStreamSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/ActivityStreamSchema",
  title: "Activity Stream",
  description: "Schema for activity stream CoStream",
  allOf: [
    { $ref: "#/$defs/costream" }
  ],
  items: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "Activity type"
      },
      message: {
        type: "string",
        description: "Activity message"
      },
      name: {
        type: "string",
        description: "Activity name"
      },
      timestamp: {
        type: "string",
        format: "date-time",
        description: "Activity timestamp"
      }
    }
  },
  $defs: coTypesDefs.$defs
};

/**
 * NotesSchema - CoList schema for notes
 */
const NotesSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/NotesSchema",
  title: "Notes",
  description: "Schema for notes CoList",
  allOf: [
    { $ref: "#/$defs/colist" }
  ],
  items: {
    type: "object",
    properties: {
      title: {
        type: "string",
        minLength: 1,
        description: "Note title"
      },
      content: {
        type: "string",
        description: "Note content"
      },
      created: {
        type: "string",
        format: "date-time",
        description: "Creation timestamp"
      }
    },
    required: ["title", "content", "created"],
    additionalProperties: false
  },
  $defs: coTypesDefs.$defs
};

/**
 * TextSchema - CoText schema for plain text CoValues
 */
const TextSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/TextSchema",
  title: "Text",
  description: "Schema for plain text CoText (leaf type)",
  allOf: [
    { $ref: "#/$defs/co-text" }
  ],
  $defs: coTypesDefs.$defs
};

/**
 * PureJsonSchema - CoMap schema demonstrating all 7 JSON Schema standard types
 */
const PureJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/PureJsonSchema",
  title: "Pure JSON",
  description: "Schema demonstrating all 7 JSON Schema standard types plus $ref co-id",
  allOf: [
    { $ref: "#/$defs/comap" }
  ],
  properties: {
    string: {
      type: "string",
      description: "Standard string type"
    },
    number: {
      type: "number",
      description: "Standard number type"
    },
    integer: {
      type: "integer",
      description: "Standard integer type"
    },
    boolean: {
      type: "boolean",
      description: "Standard boolean type"
    },
    nullValue: {
      type: "null",
      description: "Null value"
    },
    object: {
      type: "object",
      description: "Nested object",
      additionalProperties: true
    },
    array: {
      type: "array",
      description: "Array of values",
      items: {
        anyOf: [
          { type: "string" },
          { type: "number" },
          { type: "integer" },
          { type: "boolean" },
          { type: "null" },
          { type: "object" },
          { type: "array" }
        ]
      }
    },
    author: {
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      description: "Co-id reference to Profile CoMap (demonstrates co-id references - actual value is string, not object)"
    }
  },
  $defs: coTypesDefs.$defs
};

/**
 * Schema Registry - Maps schema names to schema definitions
 */
export const SCHEMA_REGISTRY = {
  AccountSchema,
  GroupSchema,
  ProfileSchema,
  ExamplesSchema,
  ActivityStreamSchema,
  NotesSchema,
  TextSchema,
  PureJsonSchema
};

/**
 * Get schema by name from hardcoded registry
 * @param {string} schemaName - Schema name (e.g., "ProfileSchema")
 * @returns {Object|null} Schema definition or null if not found
 */
export function getSchema(schemaName) {
  return SCHEMA_REGISTRY[schemaName] || null;
}

/**
 * Get all schemas from hardcoded registry
 * @returns {Object} All schema definitions
 */
export function getAllSchemas() {
  return { ...SCHEMA_REGISTRY };
}

/**
 * Check if schema exists in hardcoded registry (for migrations/seeding only)
 * @param {string} schemaName - Schema name
 * @returns {boolean} True if schema exists in hardcoded registry
 * @deprecated Only for use during migrations/seeding. Runtime should check account.os.schemata.
 */
export function hasSchema(schemaName) {
  // Only check hardcoded registry (for migrations/seeding before account.os.schemata exists)
  // Exception schemas are always valid
  const EXCEPTION_SCHEMAS = ['@account', '@group', 'GenesisSchema'];
  if (EXCEPTION_SCHEMAS.includes(schemaName)) {
    return true;
  }
  return schemaName in SCHEMA_REGISTRY;
}

/**
 * Get co-type definitions
 * @returns {Object} Co-type $defs
 */
export function getCoTypeDefs() {
  return coTypesDefs.$defs;
}

/**
 * Get meta schema definition
 * @param {string} metaSchemaCoId - Optional co-id for self-reference
 * @returns {Object} Meta schema definition
 */
export function getMetaSchema(metaSchemaCoId = null) {
  return getMetaSchemaDefinition(metaSchemaCoId);
}
