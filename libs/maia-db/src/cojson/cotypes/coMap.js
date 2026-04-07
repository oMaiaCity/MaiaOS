/**
 * CoMap Service - Generic CoMap creation
 *
 * Handles CoMap creation with MANDATORY schema validation
 * Schema is REQUIRED - no fallbacks or defaults
 */

import { loadFactoryAndValidate } from '@MaiaOS/factories/validation.helper'
import {
	createFactoryMeta,
	EXCEPTION_FACTORIES,
	FACTORY_REGISTRY,
	isExceptionFactory,
} from '../../factories/registry.js'

/**
 * Create a generic CoMap with MANDATORY schema validation
 *
 * Uses °maia spark's group when account is passed; uses group directly when resolved group passed.
 *
 * @param {RawAccount|RawGroup} accountOrGroup - Account (resolves °maia spark group) or Group
 * @param {Object} init - Initial properties
 * @param {string} factoryName - Schema name or co-id for headerMeta (REQUIRED - use "@metaSchema" for meta schema creation)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @param {Object} [dbEngine] - Database engine for runtime schema validation (REQUIRED for co-ids)
 * @returns {Promise<RawCoMap>}
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoMap(
	accountOrGroup,
	init = {},
	factoryName,
	_node = null,
	dbEngine = null,
	nanoid = null,
) {
	let group = accountOrGroup

	if (accountOrGroup && typeof accountOrGroup.createMap === 'function') {
		// Already a resolved group (e.g. from getMaiaGroup())
		group = accountOrGroup
	} else if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Check if first param is account (has get("profile") property) or group
		// Accounts have profile property, regular groups don't
		const profileId = accountOrGroup.get('profile')
		if (profileId) {
			// It's an account - resolve °maia spark's group via getSparkGroup
			const peer = dbEngine?.peer
			if (!peer) {
				throw new Error(
					'[createCoMap] dbEngine.peer required when passing account (to resolve °maia spark group)',
				)
			}
			const { getSparkGroup } = await import('../groups/groups.js')
			group = await getSparkGroup(peer, '°maia')
			if (!group) {
				throw new Error('[createCoMap] °maia spark group not found. Ensure bootstrap has run.')
			}
		}
		// If no profileId, accountOrGroup is a group - use as-is (group = accountOrGroup from line 27)
	}
	if (factoryName === EXCEPTION_FACTORIES.META_SCHEMA) {
		return group.createMap(init, { $factory: EXCEPTION_FACTORIES.META_SCHEMA })
	}
	if (!factoryName || typeof factoryName !== 'string') {
		throw new Error('[createCoMap] Schema name is REQUIRED.')
	}
	if (
		!isExceptionFactory(factoryName) &&
		!factoryName.startsWith('co_z') &&
		!(factoryName in FACTORY_REGISTRY)
	) {
		throw new Error(
			`[createCoMap] Schema '${factoryName}' not found. Available: AccountFactory, ProfileFactory`,
		)
	}
	if (!isExceptionFactory(factoryName)) {
		const validateOpts = { dataEngine: dbEngine }
		if (!factoryName.startsWith('co_z')) {
			validateOpts.getAllFactories = async () => {
				const { ensureFactoriesLoaded, getAllFactories: getAll } = await import('@MaiaOS/factories')
				await ensureFactoriesLoaded()
				return { ...getAll(), ...FACTORY_REGISTRY }
			}
		}
		await loadFactoryAndValidate(
			dbEngine?.peer || null,
			factoryName,
			init,
			'createCoMap',
			validateOpts,
		)
	}

	const meta = createFactoryMeta(factoryName, nanoid)

	// Create CoMap with metadata passed to cojson
	const comap = group.createMap(init, meta)

	return comap
}
