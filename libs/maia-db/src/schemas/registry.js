/**
 * Schema Registry - JSON Schema definitions for MaiaDB
 * 
 * Contains hardcoded schemas ONLY for migrations and seeding (before account.os.schemata exists).
 * All runtime schema access MUST load from account.os.schemata CoList.
 * 
 * NO FALLBACKS - 100% migration to CoValue-based schemas.
 */

import coTypesDefs from '@MaiaOS/schemata/co-types.defs.json';

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
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      description: "Co-id reference to Examples CoMap (optional)"
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
    },
    group: {
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      description: "Co-id reference to universal group (set by migration)"
    }
  },
  required: ["name"],
  $defs: coTypesDefs.$defs
};

/**
 * Schema Registry - Maps schema names to schema definitions
 * 
 * Only contains schemas needed for migrations/seeding (before account.os.schemata exists).
 * All runtime schema access MUST load from account.os.schemata CoList.
 */
export const SCHEMA_REGISTRY = {
  AccountSchema,
  GroupSchema,
  ProfileSchema
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
 * Get meta schema definition from backend (runtime access)
 * Always reads from CoJSON backend - single source of truth after seeding
 * 
 * @param {Object} backend - Backend instance
 * @returns {Promise<Object>} Meta schema definition
 */
export async function getMetaSchemaFromBackend(backend) {
  if (!backend) {
    throw new Error('[getMetaSchemaFromBackend] Backend required');
  }
  
  // Import resolver dynamically to avoid circular dependencies
  const { resolveHumanReadableKey } = await import('../cojson/schema/resolver.js');
  
  // Resolve metaschema co-id from registry
  const metaSchemaCoId = await resolveHumanReadableKey(backend, '@schema/meta');
  if (!metaSchemaCoId) {
    throw new Error('[getMetaSchemaFromBackend] Metaschema not found in registry');
  }
  
  // Read metaschema CoMap from backend using universal read() API
  const metaSchemaStore = await backend.read(null, metaSchemaCoId);
  if (!metaSchemaStore || metaSchemaStore.value?.error) {
    throw new Error('[getMetaSchemaFromBackend] Failed to read metaschema from backend');
  }
  
  // Extract definition from CoMap content
  const metaSchemaCoMap = metaSchemaStore.value;
  return metaSchemaCoMap.definition || metaSchemaCoMap;
}

// Re-export schema metadata utilities
export { createSchemaMeta, isExceptionSchema, validateHeaderMetaSchema, EXCEPTION_SCHEMAS } from './meta.js';

// Re-export schema loader functions (migrations/seeding only)
export { loadSchemasFromAccount } from '../cojson/schema/resolver.js';
