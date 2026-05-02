/**
 * Bootstrap-only factory JSON definitions and header metadata helpers (no peer).
 * Used by validation and migrations before spark.os catalog is populated.
 */

import { CO_TYPES_DEFS } from './co-types.js'

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

export function isExceptionFactory(factory) {
	return (
		factory === EXCEPTION_FACTORIES.ACCOUNT ||
		factory === EXCEPTION_FACTORIES.GROUP ||
		factory === EXCEPTION_FACTORIES.META_SCHEMA
	)
}

export function createFactoryMeta(factoryName, nanoid = null) {
	const meta = { $factory: factoryName }
	if (typeof nanoid === 'string' && nanoid.length > 0) {
		meta.$nanoid = nanoid
	}
	return meta
}

export function hasFactory(coValue, expectedFactory) {
	return coValue.headerMeta?.$factory === expectedFactory
}

export function getFactory(coValue) {
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
