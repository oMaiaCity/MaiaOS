/**
 * Schema Registry - JSON Schema definitions and metadata utilities for MaiaDB
 * 
 * Contains hardcoded schemas ONLY for migrations and seeding (before account.os.schemata exists).
 * All runtime schema access MUST load from account.os.schemata CoList.
 * 
 * Also provides metadata utilities for setting schema references in headerMeta.
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
 * Profile is account-owned only - identity only, no group reference.
 */
const ProfileSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://maia.city/ProfileSchema",
  title: "Profile",
  description: "Schema for profile CoMap (account-owned, identity only)",
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
export function getSchemaFromRegistry(schemaName) {
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
export function hasSchemaInRegistry(schemaName) {
	// Only check hardcoded registry (for migrations/seeding before account.os.schemata exists)
	// Exception schemas are always valid
	const EXCEPTION_SCHEMAS_LIST = ['@account', '@group', '@maia'];
	if (EXCEPTION_SCHEMAS_LIST.includes(schemaName)) {
		return true;
	}
	return schemaName in SCHEMA_REGISTRY;
}

// Registry version exported with specific name for internal use
// Internal code should import hasSchemaInRegistry directly

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
  const { resolve } = await import('../cojson/schema/resolver.js');
  
  // Resolve metaschema co-id from registry
  const metaSchemaCoId = await resolve(backend, '@maia/schema/meta', { returnType: 'coId' });
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

/**
 * Exception schemas that don't need validation against registry
 * These are special cases where headerMeta.$schema is not a co-id:
 * - @account: Account CoValue (read-only headerMeta)
 * - @group: Group CoValue (read-only headerMeta)
 * - @maia: Bootstrap/metaschema (chicken-egg - can't self-reference co-id in read-only headerMeta)
 */
export const EXCEPTION_SCHEMAS = {
	ACCOUNT: '@account',
	GROUP: '@group',
	META_SCHEMA: '@maia'
};

/**
 * Check if a schema is an exception schema
 * @param {string} schema - Schema name to check
 * @returns {boolean}
 */
export function isExceptionSchema(schema) {
	return schema === EXCEPTION_SCHEMAS.ACCOUNT || 
	       schema === EXCEPTION_SCHEMAS.GROUP || 
	       schema === EXCEPTION_SCHEMAS.META_SCHEMA;
}

/**
 * Create metadata object with schema reference
 * @param {string} schemaName - Schema name or co-id (e.g., "ProfileSchema", "co_z123...", "@account", "@group", "@maia")
 * @returns {JsonObject} Metadata object for headerMeta
 */
export function createSchemaMeta(schemaName) {
	// Exception schemas don't need registry validation
	// Note: schemaName can be a co-id (starts with "co_z") for actual schema references
	if (!isExceptionSchema(schemaName) && !schemaName.startsWith('co_z') && !hasSchemaInRegistry(schemaName)) {
		console.warn(`[createSchemaMeta] Schema '${schemaName}' not found in registry`);
	}
	
	return {
		$schema: schemaName  // Schema name, co-id, or exception schema
	};
}

/**
 * Validate that a CoValue has the expected schema in headerMeta
 * @param {RawCoValue} coValue - The CoValue to check
 * @param {string} expectedSchema - Expected schema name
 * @returns {boolean}
 */
export function hasSchemaInCoValue(coValue, expectedSchema) {
	return coValue.headerMeta?.$schema === expectedSchema;
}

/**
 * Get schema name from CoValue's headerMeta
 * @param {RawCoValue} coValue - The CoValue
 * @returns {string | null}
 */
export function getSchemaFromCoValue(coValue) {
	return coValue.headerMeta?.$schema || null;
}

// Export CoValue utilities for external API (imported by index.js)
// These override the registry versions above - JavaScript uses last export
// Different signatures allow callers to use the right one:
// - Registry: hasSchema(schemaName) - for hardcoded registry (internal use via hasSchemaInRegistry)
// - CoValue: hasSchema(coValue, expectedSchema) - for CoValue headerMeta (external API)
export function hasSchema(coValue, expectedSchema) {
	return hasSchemaInCoValue(coValue, expectedSchema);
}

export function getSchema(coValue) {
	return getSchemaFromCoValue(coValue);
}

/**
 * Validate that a CoValue has $schema in headerMeta (except exception schemas)
 * @param {RawCoValue} coValue - The CoValue to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateHeaderMetaSchema(coValue) {
	const headerMeta = coValue?.headerMeta;
	const schema = headerMeta?.$schema;
	
	// Exception schemas are always valid
	if (isExceptionSchema(schema)) {
		return { valid: true, error: null };
	}
	
	// Check if account (has type but no $schema)
	if (headerMeta?.type === 'account') {
		// Account should have $schema = "@account" (set during migration)
		if (!schema) {
			return { 
				valid: false, 
				error: 'Account CoValue missing $schema in headerMeta (should be "@account")' 
			};
		}
	}
	
	// All other CoValues must have $schema
	if (!schema) {
		return { 
			valid: false, 
			error: 'CoValue missing $schema in headerMeta (required for all CoValues except @account, @group, @maia)' 
		};
	}
	
	return { valid: true, error: null };
}

// Re-export schema loader functions (migrations/seeding only)
export { loadSchemasFromAccount } from '../cojson/schema/resolver.js';
