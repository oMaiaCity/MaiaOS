/**
 * Guardian flow: create or assert an identity CoMap (human|aven), auto-indexed under spark.os.indexes.
 */

import { extractCoValueData } from '../../primitives/data-extraction.js'
import { ensureCoValueLoaded, getCoListId } from '../crud/collection-helpers.js'
import { matchesFilter } from '../crud/filter-helpers.js'
import { removeGroupMember } from '../groups/groups.js'

const MAP_TIMEOUT_MS = 25000

async function findIdentity(peer, identitySchemaCoId, accountId, type) {
	const coListId = await getCoListId(peer, identitySchemaCoId)
	if (!coListId?.startsWith('co_z')) return null
	const coListCore = peer.getCoValue(coListId)
	if (!coListCore) return null
	await ensureCoValueLoaded(peer, coListId, { waitForAvailable: true, timeoutMs: MAP_TIMEOUT_MS })
	if (!peer.isAvailable(coListCore)) return null
	const content = peer.getCurrentContent(coListCore)
	if (!content?.toJSON) return null
	const itemIds = content.toJSON()
	const filter = { account: accountId, type }
	const seenIds = new Set()
	for (const itemId of itemIds) {
		if (typeof itemId !== 'string' || !itemId.startsWith('co_') || seenIds.has(itemId)) continue
		seenIds.add(itemId)
		await ensureCoValueLoaded(peer, itemId, { waitForAvailable: true, timeoutMs: MAP_TIMEOUT_MS })
		const itemCore = peer.getCoValue(itemId)
		if (!itemCore || !peer.isAvailable(itemCore)) continue
		const itemData = extractCoValueData(peer, itemCore)
		if (matchesFilter(itemData, filter)) return itemId
	}
	return null
}

/**
 * @param {import('../core/MaiaDB.js').MaiaDB} peer
 * @param {import('@MaiaOS/engine').DataEngine} dataEngine
 * @param {'human' | 'aven'} type
 * @param {string} accountId
 * @param {string} profileId
 */
export async function ensureIdentity({ peer, dataEngine, type, accountId, profileId }) {
	if (!accountId?.startsWith('co_z') || !profileId?.startsWith('co_z')) {
		throw new Error('ensureIdentity: accountId and profileId (co_z) required')
	}
	if (!['human', 'aven'].includes(type)) {
		throw new Error('ensureIdentity: type must be human or aven')
	}
	if (!dataEngine?.execute) {
		throw new Error('ensureIdentity: dataEngine.execute required')
	}
	if (!dataEngine.resolveSystemFactories) {
		throw new Error('ensureIdentity: resolveSystemFactories missing on dataEngine')
	}
	await dataEngine.resolveSystemFactories()

	const identitySchemaCoId = peer.infra?.identity
	if (!identitySchemaCoId?.startsWith('co_z')) {
		throw new Error('Identity schema not found — resolve system factories / peer.infra')
	}

	const existingId = await findIdentity(peer, identitySchemaCoId, accountId, type)
	if (existingId) {
		return { ok: true, alreadyRegistered: true, identityCoMapId: existingId }
	}

	const guardian = await peer.getMaiaGroup()
	if (!guardian) throw new Error('Guardian not found')

	const node = peer.node
	const identityGroup = node.createGroup()
	identityGroup.extend(guardian, 'extend')
	identityGroup.addMember('everyone', 'reader')
	const identityCoMap = identityGroup.createMap(
		{ type, account: accountId, profile: profileId },
		{ $factory: identitySchemaCoId },
	)
	const memberIdToRemove =
		typeof node.getCurrentAccountOrAgentID === 'function'
			? node.getCurrentAccountOrAgentID()
			: (peer.account?.id ?? peer.account?.$jazz?.id)
	try {
		await removeGroupMember(identityGroup, memberIdToRemove)
	} catch (_e) {}

	return { ok: true, identityCoMapId: identityCoMap.id }
}

/**
 * Account co-ids from the identity index for a given type (capabilities / members UI).
 * @param {import('../core/MaiaDB.js').MaiaDB} peer
 * @param {'human' | 'aven'} type
 * @returns {Promise<string[]>}
 */
export async function listAccountIdsFromIdentityIndex(peer, type) {
	if (!['human', 'aven'].includes(type)) return []
	if (peer.dbEngine?.resolveSystemFactories) {
		await peer.dbEngine.resolveSystemFactories()
	}
	const identitySchemaCoId = peer.infra?.identity
	if (!identitySchemaCoId?.startsWith('co_z')) return []
	const coListId = await getCoListId(peer, identitySchemaCoId)
	if (!coListId?.startsWith('co_z')) return []
	await ensureCoValueLoaded(peer, coListId, { waitForAvailable: true, timeoutMs: MAP_TIMEOUT_MS })
	const coListCore = peer.getCoValue(coListId)
	if (!coListCore || !peer.isAvailable(coListCore)) return []
	const content = peer.getCurrentContent(coListCore)
	if (!content?.toJSON) return []
	const itemIds = content.toJSON()
	const accounts = []
	const seen = new Set()
	for (const itemId of itemIds) {
		if (typeof itemId !== 'string' || !itemId.startsWith('co_')) continue
		await ensureCoValueLoaded(peer, itemId, { waitForAvailable: true, timeoutMs: 8000 })
		const itemCore = peer.getCoValue(itemId)
		if (!itemCore || !peer.isAvailable(itemCore)) continue
		const itemData = extractCoValueData(peer, itemCore)
		if (itemData?.type !== type) continue
		const acc = itemData?.account
		if (acc?.startsWith('co_z') && !seen.has(acc)) {
			seen.add(acc)
			accounts.push(acc)
		}
	}
	return accounts
}
