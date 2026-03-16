/**
 * Universal co-id resolution and context loading.
 * Replaces duplicated resolution patterns across ActorEngine, ViewEngine, InboxEngine, ProcessEngine.
 */

import { ensureCoValueLoaded, waitForStoreReady } from '@MaiaOS/db'
import { readStore } from './store-reader.js'

/**
 * Resolve human-readable ref to co-id.
 * @param {Object} peer - MaiaDB peer
 * @param {string} ref - Ref (co_z... or namekey like °Maia/actor/...)
 * @returns {Promise<string|null>} Co-id or null
 */
export async function resolveToCoId(peer, ref) {
	if (!ref || typeof ref !== 'string') return null
	if (ref.startsWith('co_z')) return ref
	if (!peer) return null
	const toResolve = ref.startsWith('Maia/') && !ref.startsWith('°') ? `°${ref}` : ref
	const resolved = await peer.resolve(toResolve, { returnType: 'coId' })
	return resolved && typeof resolved === 'string' && resolved.startsWith('co_z') ? resolved : null
}

/**
 * Resolve schema co-id from a CoValue.
 * @param {Object} peer - MaiaDB peer
 * @param {string} coId - CoValue co-id
 * @returns {Promise<string|null>} Schema co-id or null
 */
export async function resolveSchemaFromCoValue(peer, coId) {
	if (!peer || !coId?.startsWith('co_z')) return null
	try {
		return await peer.resolve({ fromCoValue: coId }, { returnType: 'coId' })
	} catch {
		return null
	}
}

/**
 * Load context store by ref. Resolves ref to co-id, reads store, gets schema.
 * @param {Object} dataEngine - DataEngine with peer
 * @param {string} ref - Context ref (co-id or namekey)
 * @param {Object} [options] - { waitForStoreReadyMs, ensureLoaded, retries }
 * @returns {Promise<{store: Object|null, coId: string|null, schemaCoId: string|null}>}
 */
export async function loadContextStore(dataEngine, ref, options = {}) {
	const peer = dataEngine?.peer
	const coId = ref?.startsWith('co_z') ? ref : await resolveToCoId(peer, ref)
	if (!coId) return { store: null, coId: null, schemaCoId: null }

	if (options.ensureLoaded && peer) {
		await ensureCoValueLoaded(peer, coId, options.ensureLoaded).catch(() => {})
	}
	let store = await readStore(dataEngine, coId)
	const retries = options.retries ?? 0
	for (let i = 0; !store && i < retries; i++) {
		await new Promise((r) => setTimeout(r, 150 + i * 100))
		store = await readStore(dataEngine, coId)
	}
	if (!store) return { store: null, coId, schemaCoId: null }

	if (options.waitForStoreReadyMs) {
		await waitForStoreReady(store, coId, options.waitForStoreReadyMs).catch(() => {})
	}
	const schemaCoId = await resolveSchemaFromCoValue(peer, coId)
	return { store, coId, schemaCoId }
}
