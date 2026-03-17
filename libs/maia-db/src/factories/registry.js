/**
 * Schema Registry - JSON Schema definitions and metadata utilities for MaiaDB
 *
 * Contains hardcoded schemas ONLY for migrations and seeding (before spark.os.factories exists).
 * All runtime schema access MUST load from account.registries.sparks[°Maia].os.factories.
 *
 * Also provides metadata utilities for setting schema references in headerMeta.
 *
 * NO FALLBACKS - 100% migration to CoValue-based schemas.
 */

import coTypesDefs from '@MaiaOS/factories/co-types.defs.json'

/**
 * AccountFactory - CoMap schema for account CoValues
 * Accounts have special properties: sealer, signer, readKey, profile, examples
 */
const AccountFactory = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://maia.city/AccountFactory',
	title: 'Account',
	description: 'Schema for account CoMap (special CoMap with authentication properties)',
	allOf: [{ $ref: '#/$defs/comap' }],
	properties: {
		sealer: {
			type: 'string',
			pattern: '^sealer_',
			description: 'Sealer key for encryption',
		},
		signer: {
			type: 'string',
			pattern: '^signer_',
			description: 'Signer key for signing',
		},
		readKey: {
			type: 'string',
			description: 'Read key for decryption',
		},
		profile: {
			allOf: [
				{
					type: 'string',
					pattern: '^co_z[a-zA-Z0-9]+$',
					description: 'Co-id reference to Profile CoMap',
				},
				{
					$ref: 'https://maia.city/ProfileFactory',
				},
			],
		},
		examples: {
			type: 'string',
			pattern: '^co_z[a-zA-Z0-9]+$',
			description: 'Co-id reference to Examples CoMap (optional)',
		},
	},
	required: ['profile'],
	$defs: coTypesDefs.$defs,
}

/**
 * GroupFactory - CoMap schema for group CoValues
 * Groups have members and permissions
 */
const GroupFactory = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://maia.city/GroupFactory',
	title: 'Group',
	description: 'Schema for group CoMap (special CoMap with member management)',
	allOf: [{ $ref: '#/$defs/comap' }],
	properties: {
		// Groups can have members (co-ids) and permissions
		// Structure depends on cojson's group implementation
	},
	$defs: coTypesDefs.$defs,
}

/**
 * ProfileFactory - CoMap schema for profile CoValues
 * Profile is account-owned only - identity only, no group reference.
 */
const ProfileFactory = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://maia.city/ProfileFactory',
	title: 'Profile',
	description: 'Schema for profile CoMap (account-owned, identity only)',
	allOf: [{ $ref: '#/$defs/comap' }],
	properties: {
		name: {
			type: 'string',
			minLength: 1,
			description: "User's display name",
		},
		avatar: {
			type: 'string',
			pattern: '^co_z[a-zA-Z0-9]+$',
			description: 'CoBinary co-id for profile image',
		},
	},
	required: ['name'],
	$defs: coTypesDefs.$defs,
}

/**
 * Schema Registry - Maps schema names to schema definitions
 *
 * Only contains schemas needed for migrations/seeding (before spark.os.factories exists).
 * All runtime schema access MUST load from account.registries.sparks[°Maia].os.factories.
 */
export const FACTORY_REGISTRY = {
	AccountFactory,
	GroupFactory,
	ProfileFactory,
}

/**
 * Get schema by name from hardcoded registry
 * @param {string} factoryName - Schema name (e.g., "ProfileFactory")
 * @returns {Object|null} Schema definition or null if not found
 */
export function getFactoryFromRegistry(factoryName) {
	return FACTORY_REGISTRY[factoryName] || null
}

/**
 * Get all schemas from hardcoded registry
 * @returns {Object} All schema definitions
 */
export function getAllFactories() {
	return { ...FACTORY_REGISTRY }
}

/**
 * Check if schema exists in hardcoded registry (for migrations/seeding only)
 * @param {string} factoryName - Schema name
 * @returns {boolean} True if schema exists in hardcoded registry
 */
export function hasFactoryInRegistry(factoryName) {
	// Only check hardcoded registry (for migrations/seeding before spark.os.factories exists)
	// Exception schemas are always valid
	const EXCEPTION_FACTORIES_LIST = ['@account', '@group', '@metaSchema']
	if (EXCEPTION_FACTORIES_LIST.includes(factoryName)) {
		return true
	}
	return factoryName in FACTORY_REGISTRY
}

// Registry version exported with specific name for internal use
// Internal code should import hasFactoryInRegistry directly

/**
 * Assert schema is valid for CoValue creation. Throws if invalid.
 * Single source of truth for coMap, coList, coStream.
 * Skips registry check for: exception schemas, co-ids (co_z...).
 * @param {string} factoryName - Schema name or co-id
 * @param {string} cotype - Caller name for error message (e.g. 'createCoMap')
 */
export function assertFactoryValidForCreate(factoryName, cotype = 'createCoValue') {
	if (!factoryName || typeof factoryName !== 'string') {
		throw new Error(`[${cotype}] Schema name is REQUIRED.`)
	}
	if (
		isExceptionFactory(factoryName) ||
		factoryName.startsWith('co_z') ||
		hasFactoryInRegistry(factoryName)
	) {
		return
	}
	throw new Error(
		`[${cotype}] Schema '${factoryName}' not found in registry. Available: AccountFactory, GroupFactory, ProfileFactory`,
	)
}

/**
 * Get co-type definitions
 * @returns {Object} Co-type $defs
 */
export function getCoTypeDefs() {
	return coTypesDefs.$defs
}

/**
 * Get meta schema definition from peer (runtime access)
 * Always reads from CoJSON - single source of truth after seeding
 *
 * @param {Object} peer - Peer instance (MaiaDB)
 * @returns {Promise<Object>} Meta schema definition
 */
export async function getMetaFactoryFromPeer(peer) {
	if (!peer) {
		throw new Error('[getMetaFactoryFromPeer] Peer required')
	}

	// Import resolver dynamically to avoid circular dependencies
	const { resolve } = await import('../cojson/factory/resolver.js')

	// Resolve metaschema co-id from registry
	const metaSchemaCoId = await resolve(peer, '°Maia/factory/meta', { returnType: 'coId' })
	if (!metaSchemaCoId) {
		throw new Error('[getMetaFactoryFromPeer] Metaschema not found in registry')
	}

	// Read metaschema CoMap from peer using universal read() API
	const metaSchemaStore = await peer.read(null, metaSchemaCoId)
	if (!metaSchemaStore || metaSchemaStore.value?.error) {
		throw new Error('[getMetaFactoryFromPeer] Failed to read metaschema from peer')
	}

	// Extract definition from CoMap content
	const metaSchemaCoMap = metaSchemaStore.value
	return metaSchemaCoMap.definition || metaSchemaCoMap
}

/**
 * Exception schemas that don't need validation against registry
 * These are special cases where headerMeta.$schema is not a co-id:
 * - @account: Account CoValue (read-only headerMeta)
 * - @group: Group CoValue (read-only headerMeta)
 * - @metaSchema: Bootstrap/metaschema (chicken-egg - can't self-reference co-id in read-only headerMeta)
 */
export const EXCEPTION_FACTORIES = {
	ACCOUNT: '@account',
	GROUP: '@group',
	META_SCHEMA: '@metaSchema',
}

/**
 * Check if a schema is an exception schema
 * @param {string} schema - Schema name to check
 * @returns {boolean}
 */
export function isExceptionFactory(schema) {
	return (
		schema === EXCEPTION_FACTORIES.ACCOUNT ||
		schema === EXCEPTION_FACTORIES.GROUP ||
		schema === EXCEPTION_FACTORIES.META_SCHEMA
	)
}

/**
 * Create metadata object with schema reference
 * @param {string} factoryName - Schema name or co-id (e.g., "ProfileFactory", "co_z123...", "@account", "@group", "°Maia")
 * @returns {JsonObject} Metadata object for headerMeta
 */
export function createFactoryMeta(factoryName) {
	// Exception schemas don't need registry validation
	// Note: factoryName can be a co-id (starts with "co_z") for actual schema references
	if (
		!isExceptionFactory(factoryName) &&
		!factoryName.startsWith('co_z') &&
		!hasFactoryInRegistry(factoryName)
	) {
	}

	return {
		$factory: factoryName, // Factory name, co-id, or exception factory
	}
}

/**
 * Validate that a CoValue has the expected schema in headerMeta
 * @param {RawCoValue} coValue - The CoValue to check
 * @param {string} expectedSchema - Expected schema name
 * @returns {boolean}
 */
export function hasFactoryInCoValue(coValue, expectedFactory) {
	return coValue.headerMeta?.$factory === expectedFactory
}

/**
 * Get schema name from CoValue's headerMeta
 * @param {RawCoValue} coValue - The CoValue
 * @returns {string | null}
 */
export function getFactoryFromCoValue(coValue) {
	return coValue.headerMeta?.$factory || null
}

// Export CoValue utilities for external API (imported by index.js)
// These override the registry versions above - JavaScript uses last export
// Different signatures allow callers to use the right one:
// - Registry: hasSchema(factoryName) - for hardcoded registry (internal use via hasFactoryInRegistry)
// - CoValue: hasSchema(coValue, expectedSchema) - for CoValue headerMeta (external API)
export function hasSchema(coValue, expectedSchema) {
	return hasFactoryInCoValue(coValue, expectedSchema)
}

export function getSchema(coValue) {
	return getFactoryFromCoValue(coValue)
}

/**
 * Validate that a CoValue has $schema in headerMeta (except exception schemas)
 * @param {RawCoValue} coValue - The CoValue to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateHeaderMetaFactory(coValue) {
	const headerMeta = coValue?.headerMeta
	const factory = headerMeta?.$factory

	// Exception factories are always valid
	if (isExceptionFactory(factory)) {
		return { valid: true, error: null }
	}

	// Check if account (has type but no $factory)
	if (headerMeta?.type === 'account') {
		// Account should have $factory = "@account" (set during migration)
		if (!factory) {
			return {
				valid: false,
				error: 'Account CoValue missing $factory in headerMeta (should be "@account")',
			}
		}
	}

	// All other CoValues must have $factory
	if (!factory) {
		return {
			valid: false,
			error:
				'CoValue missing $factory in headerMeta (required for all CoValues except @account, @group, @metaSchema)',
		}
	}

	return { valid: true, error: null }
}

// Re-export schema loader functions (migrations/seeding only)
export { loadFactoriesFromAccount } from '../cojson/factory/resolver.js'
