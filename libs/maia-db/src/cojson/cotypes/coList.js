import { loadFactoryAndValidate } from '@MaiaOS/factories/validation.helper'
import {
	assertFactoryValidForCreate,
	createFactoryMeta,
	getAllFactories,
	isExceptionFactory,
} from '../../factories/registry.js'

/**
 * Create a generic CoList with MANDATORY schema validation
 *
 * Uses °Maia spark's group when account is passed.
 *
 * @param {RawAccount|RawGroup} accountOrGroup - Account (resolves °Maia spark group) or Group
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
) {
	let group = accountOrGroup

	// Check if first param is account (has get("profile") property) or group
	// Accounts have profile property, regular groups don't
	if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Try to get profile - if it exists, it's an account
		const profileId = accountOrGroup.get('profile')
		if (profileId) {
			// It's an account - resolve °Maia spark's group via getSparkGroup
			const peer = dbEngine?.peer
			if (!peer) {
				throw new Error(
					'[createCoList] dbEngine.peer required when passing account (to resolve °Maia spark group)',
				)
			}
			const { getSparkGroup } = await import('../groups/groups.js')
			group = await getSparkGroup(peer, '°Maia')
			if (!group) {
				throw new Error('[createCoList] °Maia spark group not found. Ensure bootstrap has run.')
			}
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	assertFactoryValidForCreate(factoryName, 'createCoList')

	// Validate data against schema BEFORE creating CoValue
	// STRICT: Always validate using runtime schema from database (no fallbacks, no legacy hacks)
	if (!isExceptionFactory(factoryName)) {
		// Use consolidated universal validation function (single source of truth)
		await loadFactoryAndValidate(dbEngine?.peer || null, factoryName, init, 'createCoList', {
			dataEngine: dbEngine,
			getAllFactories,
		})
	}

	const meta = createFactoryMeta(factoryName)
	const colist = group.createList(init, meta)
	return colist
}
