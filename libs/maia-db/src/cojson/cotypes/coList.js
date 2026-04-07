import { loadFactoryAndValidate } from '@MaiaOS/factories/validation.helper'
import {
	createFactoryMeta,
	FACTORY_REGISTRY,
	isExceptionFactory,
} from '../../factories/registry.js'

/**
 * Create a generic CoList with MANDATORY schema validation
 *
 * Uses °maia spark's group when account is passed.
 *
 * @param {RawAccount|RawGroup} accountOrGroup - Account (resolves °maia spark group) or Group
 * @param {Array} init - Initial items (can be primitives or co-ids)
 * @param {string} factoryName - Schema name for headerMeta.$schema (REQUIRED)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @returns {Promise<RawCoList>} The created CoList
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoList(
	accountOrGroup,
	init = [],
	factoryName,
	_node = null,
	dbEngine = null,
	nanoid = null,
) {
	let group = accountOrGroup

	// Check if first param is account (has get("profile") property) or group
	// Accounts have profile property, regular groups don't
	if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Try to get profile - if it exists, it's an account
		const profileId = accountOrGroup.get('profile')
		if (profileId) {
			// It's an account - resolve °maia spark's group via getSparkGroup
			const peer = dbEngine?.peer
			if (!peer) {
				throw new Error(
					'[createCoList] dbEngine.peer required when passing account (to resolve °maia spark group)',
				)
			}
			const { getSparkGroup } = await import('../groups/groups.js')
			group = await getSparkGroup(peer, '°maia')
			if (!group) {
				throw new Error('[createCoList] °maia spark group not found. Ensure bootstrap has run.')
			}
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	if (!factoryName || typeof factoryName !== 'string') {
		throw new Error('[createCoList] Schema name is REQUIRED.')
	}
	if (
		!isExceptionFactory(factoryName) &&
		!factoryName.startsWith('co_z') &&
		!(factoryName in FACTORY_REGISTRY)
	) {
		throw new Error(
			`[createCoList] Schema '${factoryName}' not found. Available: AccountFactory, ProfileFactory`,
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
			'createCoList',
			validateOpts,
		)
	}

	const meta = createFactoryMeta(factoryName, nanoid)
	const colist = group.createList(init, meta)
	return colist
}
