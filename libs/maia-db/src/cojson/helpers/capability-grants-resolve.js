/**
 * Resolve spark.os.indexes[OS_CAPABILITY schema co-id] — the schema index CoList for Capability grants.
 * Uses {@link getFactoryIndexColistId} so an empty index colist is ensured when none exists yet (same as other indexed factories).
 */

import { getFactoryIndexColistId } from '../crud/collection-helpers.js'
import { waitForStoreReady } from '../crud/read-operations.js'
import { RUNTIME_REF, resolveInfraFactoryCoId } from '../factory/runtime-factory-refs.js'
import { collectCapabilityGrantCoIdsFromColistContent } from './capability-grant-co-ids.js'

/**
 * Co-id of the Capability schema index CoList (spark.os.indexes[capability schema co-id]).
 * @param {Object} maia - MaiaDB instance with dataEngine.peer
 * @returns {Promise<string|null>}
 */
export async function getCapabilityGrantIndexColistCoId(maia) {
	const account = maia?.id?.maiaId
	const peer = maia?.dataEngine?.peer
	if (!account || !peer) return null
	return getCapabilityGrantIndexColistCoIdFromPeer(peer, account)
}

/**
 * @param {object} peer - MaiaDB (or compatible) with {@link import('@MaiaOS/db').MaiaDB.prototype.account}
 * @param {object} _account - reserved (account CoMap); resolution uses peer + runtime OS_CAPABILITY ref
 * @returns {Promise<string|null>}
 */
export async function getCapabilityGrantIndexColistCoIdFromPeer(peer, _account) {
	const capSchema = resolveInfraFactoryCoId(peer, RUNTIME_REF.OS_CAPABILITY)
	if (!capSchema?.startsWith('co_z')) return null
	try {
		return await getFactoryIndexColistId(peer, capSchema)
	} catch {
		return null
	}
}

/**
 * @param {object} peer
 * @param {object} account
 * @param {string} accountId
 * @param {string} cmd
 * @returns {Promise<boolean>}
 */
export async function accountHasCapabilityOnPeer(peer, account, accountId, cmd) {
	if (!accountId?.startsWith('co_z') || !cmd) return false
	const colistId = await getCapabilityGrantIndexColistCoIdFromPeer(peer, account)
	if (!colistId?.startsWith('co_z')) return false
	const core = peer.node.getCoValue(colistId)
	if (!core || !peer.isAvailable(core)) return false
	const content = peer.getCurrentContent(core)
	if (!content) return false
	if (content.type !== undefined && content.type !== 'colist') return false
	const now = Math.floor(Date.now() / 1000)
	const allCoIds = collectCapabilityGrantCoIdsFromColistContent(content)
	for (const capCoId of allCoIds) {
		let capContent
		try {
			capContent = await loadCoMapContent(peer, capCoId, { timeout: 3000 })
		} catch {
			continue
		}
		if (!capContent?.get) continue
		const sub = capContent.get('sub')
		const capCmd = capContent.get('cmd')
		const exp = capContent.get('exp')
		if (sub !== accountId || typeof exp !== 'number' || exp <= now) continue
		if (capCmd === cmd || capCmd === '/admin') return true
	}
	return false
}

/**
 * @param {object} peer
 * @param {string} coId
 * @param {{ timeout?: number }} [opts]
 * @returns {Promise<object|null>}
 */
async function loadCoMapContent(peer, coId, opts = {}) {
	const { timeout = 5000 } = opts
	const store = await peer.read(null, coId)
	await waitForStoreReady(store, coId, timeout)
	const core = peer.node.getCoValue(coId)
	if (!core || !peer.isAvailable(core)) return null
	return peer.getCurrentContent(core)
}
