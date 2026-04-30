/**
 * Bulk index rebuild — depends on the full indexing pipeline (dynamic import avoids ESM cycle with factory-index-manager).
 */

import { createLogger } from '@MaiaOS/logs'

const log = createLogger('maia-db')

/**
 * One pass over all local CoValues: (re)apply catalog + instance indexes. Used after seed with indexing disabled.
 * @param {object} peer
 * @returns {Promise<void>}
 */
export async function rebuildAllIndexes(peer) {
	const { applyPersistentCoValueIndexing } = await import('./factory-index-manager.js')
	const map = peer.getAllCoValues?.() ?? peer.node?.coValues
	if (!map || typeof map.entries !== 'function') return
	for (const [coId, core] of map.entries()) {
		if (!coId?.startsWith('co_z') || !core) continue
		if (!peer.isAvailable?.(core)) continue
		if (!core.hasVerifiedContent?.()) continue
		try {
			await applyPersistentCoValueIndexing(peer, core)
		} catch (error) {
			const isFactoryCompilationError = error?.message?.includes('Failed to compile factory')
			if (!isFactoryCompilationError) {
				log.error('[rebuildAllIndexes] failed for', coId, error)
			}
		}
	}
}
