/**
 * createCoValueForSpark - Standalone util for creating CoValues with guardian-only admin
 *
 * All create CoValue flows MUST use this util. Unified 3-step flow:
 * 1. Create group (CoJSON assigns account as direct admin)
 * 2. Add guardian as admin parent
 * 3. Account leaves group (no direct members, only guardian)
 *
 * Exception: guardian itself is NOT created via this util - it keeps the account.
 */

import { createCoList } from '../cotypes/coList.js'
import { createCoMap } from '../cotypes/coMap.js'
import { createCoStream } from '../cotypes/coStream.js'
import { getSparkGroup, removeGroupMember } from '../groups/groups.js'

/**
 * Resolve guardian from context.
 * @param {Object} context - Backend or { node, account, guardian }
 * @param {string|null} spark - Spark name (e.g. '°Maia') or null when context has guardian
 * @returns {Promise<{ node, account, guardian }>}
 */
async function resolveContext(context, spark) {
	if (context.node && context.account && context.guardian) {
		return {
			node: context.node,
			account: context.account,
			guardian: context.guardian,
		}
	}
	if (context.node && context.account && spark) {
		const guardian = await getSparkGroup(context, spark)
		return { node: context.node, account: context.account, guardian }
	}
	throw new Error(
		'[createCoValueForSpark] Invalid context. Provide backend (with node, account) + spark, or { node, account, guardian }.',
	)
}

/**
 * Create a CoValue owned by a spark (guardian-only admin, no direct account).
 * All create CoValue flows MUST use this util.
 *
 * @param {Object} context - Backend (has node, account, getMaiaGroup) OR { node, account, guardian }
 * @param {string|null} spark - Spark name (e.g. '°Maia'). Null when context has guardian.
 * @param {Object} options
 * @param {string} options.schema - Schema co-id or name for headerMeta.$schema
 * @param {'comap'|'colist'|'costream'} options.cotype
 * @param {Object} [options.data] - Init data for map (object) or list (array). Required for comap/colist.
 * @param {Object} [options.dataEngine] - For schema validation (optional during seed)
 * @returns {Promise<{ coValue: RawCoValue }>}
 */
export async function createCoValueForSpark(context, spark, options) {
	const { schema, cotype, data, dataEngine } = options
	if (!schema || typeof schema !== 'string') {
		throw new Error('[createCoValueForSpark] options.schema is required')
	}
	if (!cotype || !['comap', 'colist', 'costream'].includes(cotype)) {
		throw new Error('[createCoValueForSpark] options.cotype must be comap, colist, or costream')
	}

	const { node, account, guardian } = await resolveContext(context, spark)
	if (!account) {
		throw new Error('[createCoValueForSpark] Account required')
	}

	// Step 1: Create group
	const group = node.createGroup()

	// Step 2: Add guardian as admin
	group.extend(guardian, 'admin')

	// Create CoValue
	let coValue
	const _meta = { $schema: schema }
	switch (cotype) {
		case 'comap':
			coValue = await createCoMap(group, data ?? {}, schema, node, dataEngine)
			break
		case 'colist':
			coValue = await createCoList(group, Array.isArray(data) ? data : [], schema, node, dataEngine)
			break
		case 'costream':
			coValue = await createCoStream(group, schema, node, dataEngine)
			break
		default:
			throw new Error(`[createCoValueForSpark] Unsupported cotype: ${cotype}`)
	}

	// Step 3: Account leaves group (guardian remains as admin via extend)
	// Use node.getCurrentAccountOrAgentID() to match the key createGroup used (not account.id)
	const memberIdToRemove =
		typeof node.getCurrentAccountOrAgentID === 'function'
			? node.getCurrentAccountOrAgentID()
			: (account?.id ?? account?.$jazz?.id)
	try {
		await removeGroupMember(group, memberIdToRemove)
	} catch (e) {
		// wouldLeaveNoAdmins: should not happen (guardian is admin)
		throw new Error(`[createCoValueForSpark] Failed to remove account from group: ${e.message}`)
	}

	return { coValue }
}
