/**
 * Universal co-id resolution and context loading.
 * Replaces duplicated resolution patterns across ActorEngine, ViewEngine, InboxEngine, ProcessEngine.
 */

import { ensureCoValueLoaded, waitForStoreReady } from '@MaiaOS/db'

/**
 * Read a CoValue store by co-id.
 * Refs must be transformed to co-ids during seeding; runtime never resolves refs.
 * @param {Object} dataEngine - DataEngine with peer and execute
 * @param {string} coId - CoValue co-id (co_z...)
 * @returns {Promise<Object|null>} Store or null
 */
export async function readStore(dataEngine, coId) {
	if (!dataEngine?.peer) return null
	if (!coId || typeof coId !== 'string') return null
	if (!coId.startsWith('co_z')) {
		throw new Error(
			`[StoreReader] Expected co-id (co_z...), got ref: ${coId}. ` +
				`Refs must be transformed to co-ids during seeding. Re-run sync genesis (PEER_SYNC_SEED=true once) or wipe local storage and re-seed.`,
		)
	}
	const factoryCoId = await dataEngine.peer.resolve({ fromCoValue: coId }, { returnType: 'coId' })
	if (!factoryCoId) return null
	return dataEngine.execute({ op: 'read', factory: factoryCoId, key: coId })
}

/**
 * Runtime: refs must already be co-ids (seed transforms namekeys).
 * @param {Object} _peer - Unused (kept for call-site shape)
 * @param {string} ref - Co-id (co_z...)
 * @returns {Promise<string|null>}
 */
export async function resolveToCoId(_peer, ref) {
	if (!ref || typeof ref !== 'string') return null
	if (ref.startsWith('co_z')) return ref
	throw new Error(`[resolveToCoId] Expected co-id (co_z...), got: ${ref}`)
}

/**
 * Resolve schema co-id from a CoValue.
 * Reads header.meta.$factory directly from CoValueCore (fast path).
 * Falls back to peer.resolve({ fromCoValue }) if direct read fails.
 * @param {Object} peer - MaiaDB peer
 * @param {string} coId - CoValue co-id
 * @returns {Promise<string|null>} Schema co-id or null
 */
export async function resolveSchemaFromCoValue(peer, coId) {
	if (!peer || !coId?.startsWith('co_z')) return null
	try {
		const coValueCore = peer.getCoValue(coId)
		if (coValueCore?.isAvailable()) {
			const readFactory = () => {
				const meta = coValueCore.meta
				if (meta?.$factory && typeof meta.$factory === 'string' && meta.$factory.startsWith('co_z'))
					return meta.$factory
				const header = peer.getHeader(coValueCore)
				const factory = header?.meta?.$factory
				if (factory && typeof factory === 'string' && factory.startsWith('co_z')) return factory
				return null
			}
			let factory = readFactory()
			if (factory) return factory
			// Wait for header.meta to arrive via sync (handles timing race)
			for (let i = 0; i < 10; i++) {
				await new Promise((r) => setTimeout(r, 100 + i * 50))
				factory = readFactory()
				if (factory) return factory
			}
		}
		return await peer.resolve({ fromCoValue: coId }, { returnType: 'coId' })
	} catch {
		return null
	}
}

/**
 * Load context store by co-id. Runtime uses co-ids exclusively; refs must be transformed during seeding.
 * @param {Object} dataEngine - DataEngine with peer
 * @param {string} ref - Context co-id (co_z...)
 * @param {Object} [options] - { waitForStoreReadyMs, ensureLoaded, retries }
 * @returns {Promise<{store: Object|null, coId: string|null, factoryCoId: string|null}>}
 */
export async function loadContextStore(dataEngine, ref, options = {}) {
	if (!ref?.startsWith('co_z')) return { store: null, coId: null, factoryCoId: null }
	const peer = dataEngine?.peer
	const coId = ref

	if (options.ensureLoaded && peer) {
		await ensureCoValueLoaded(peer, coId, options.ensureLoaded).catch(() => {})
	}
	let store = await readStore(dataEngine, coId)
	const retries = options.retries ?? 0
	for (let i = 0; !store && i < retries; i++) {
		await new Promise((r) => setTimeout(r, 150 + i * 100))
		store = await readStore(dataEngine, coId)
	}
	if (!store) return { store: null, coId, factoryCoId: null }

	if (options.waitForStoreReadyMs) {
		await waitForStoreReady(store, coId, options.waitForStoreReadyMs).catch(() => {})
	}
	const factoryCoId = await resolveSchemaFromCoValue(peer, coId)
	return { store, coId, factoryCoId }
}
