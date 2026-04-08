/**
 * Schema Registry - Bootstrap schemas and metadata utilities for MaiaDB
 *
 * Hardcoded schemas ONLY for migrations/seeding (before peer.systemFactoryCoIds is filled).
 * Runtime schema access resolves via catalog + instances (see resolveSystemFactories).
 */

import { getRuntimeRef, RUNTIME_REF } from '../cojson/factory/runtime-factory-refs.js'
import { CO_TYPES_DEFS } from './co-types-defs.data.js'

const AccountFactory = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://maia.city/AccountFactory',
	title: 'Account',
	description: 'Schema for account CoMap',
	allOf: [{ $ref: '#/$defs/comap' }],
	properties: {
		sealer: { type: 'string', pattern: '^sealer_', description: 'Sealer key' },
		signer: { type: 'string', pattern: '^signer_', description: 'Signer key' },
		readKey: { type: 'string', description: 'Read key' },
		profile: {
			allOf: [
				{ type: 'string', pattern: '^co_z[a-zA-Z0-9]+$' },
				{ $ref: 'https://maia.city/ProfileFactory' },
			],
		},
		examples: { type: 'string', pattern: '^co_z[a-zA-Z0-9]+$' },
	},
	required: ['profile'],
	$defs: CO_TYPES_DEFS,
}

const ProfileFactory = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://maia.city/ProfileFactory',
	title: 'Profile',
	description: 'Profile CoMap (account-owned, identity only)',
	allOf: [{ $ref: '#/$defs/comap' }],
	properties: {
		name: { type: 'string', minLength: 1, description: "User's display name" },
		avatar: { type: 'string', pattern: '^co_z[a-zA-Z0-9]+$', description: 'CoBinary co-id' },
	},
	required: ['name'],
	$defs: CO_TYPES_DEFS,
}

export const FACTORY_REGISTRY = { AccountFactory, ProfileFactory }

export const EXCEPTION_FACTORIES = {
	ACCOUNT: '@account',
	GROUP: '@group',
	META_SCHEMA: '@metaSchema',
}

export function isExceptionFactory(schema) {
	return (
		schema === EXCEPTION_FACTORIES.ACCOUNT ||
		schema === EXCEPTION_FACTORIES.GROUP ||
		schema === EXCEPTION_FACTORIES.META_SCHEMA
	)
}

export function createFactoryMeta(factoryName, nanoid = null) {
	const meta = { $factory: factoryName }
	if (typeof nanoid === 'string' && nanoid.length > 0) {
		meta.$nanoid = nanoid
	}
	return meta
}

export function hasSchema(coValue, expectedSchema) {
	return coValue.headerMeta?.$factory === expectedSchema
}

export function getSchema(coValue) {
	return coValue.headerMeta?.$factory || null
}

export function validateHeaderMetaFactory(coValue) {
	const headerMeta = coValue?.headerMeta
	const factory = headerMeta?.$factory
	if (isExceptionFactory(factory)) return { valid: true, error: null }
	if (headerMeta?.type === 'account' && !factory) {
		return {
			valid: false,
			error: 'Account CoValue missing $factory in headerMeta (should be "@account")',
		}
	}
	if (!factory) {
		return {
			valid: false,
			error:
				'CoValue missing $factory in headerMeta (required for all CoValues except @account, @group, @metaSchema)',
		}
	}
	return { valid: true, error: null }
}

export async function getMetaFactoryFromPeer(peer) {
	if (!peer) throw new Error('[getMetaFactoryFromPeer] Peer required')
	const metaSchemaCoId = getRuntimeRef(peer, RUNTIME_REF.META)
	if (!metaSchemaCoId) throw new Error('[getMetaFactoryFromPeer] Metaschema not found in registry')
	const metaSchemaStore = await peer.read(null, metaSchemaCoId)
	if (!metaSchemaStore || metaSchemaStore.value?.error) {
		throw new Error('[getMetaFactoryFromPeer] Failed to read metaschema from peer')
	}
	const metaSchemaCoMap = metaSchemaStore.value
	return metaSchemaCoMap.definition || metaSchemaCoMap
}

export { loadFactoriesFromAccount } from '../cojson/factory/resolver.js'
