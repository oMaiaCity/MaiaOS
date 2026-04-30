import { createLogger } from '@MaiaOS/logs/subsystem-logger'
import { ensureCoValueLoaded } from '../../primitives/ensure-covalue-core.js'

const log = createLogger('maia-db')

/** Warm-load for indexing; avoids universal read() (Sentrux: breaks SCC with collection-helpers). */
export async function ensureCoValueReadyForIndex(peer, coId, timeoutMs) {
	try {
		await ensureCoValueLoaded(peer, coId, { waitForAvailable: true, timeoutMs })
		const core = peer.getCoValue(coId)
		return Boolean(core && peer.isAvailable(core))
	} catch {
		return false
	}
}

export async function resolveFactoryAuthoring(peer, identifier, options) {
	const { resolve } = await import('../factory/authoring-resolver.js')
	return resolve(peer, identifier, options)
}

/** Single load path for index colists (no universalRead fallback). */
export async function loadIndexColistContent(peer, indexColistId, timeoutMs = 8000) {
	const start = Date.now()
	let core
	try {
		core = await ensureCoValueLoaded(peer, indexColistId, { waitForAvailable: true, timeoutMs })
	} catch {
		return null
	}
	if (!core?.isAvailable?.()) return null
	const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.()
	if (!content) return null
	const contentType = content.cotype || content.type
	if (contentType !== 'colist') return null
	if (typeof process !== 'undefined' && process.env?.DEBUG && Date.now() - start > 2000) {
		log.debug('[DEBUG loadIndexColistContent] slow', indexColistId, Date.now() - start, 'ms')
	}
	return content
}

/** Mutable bootstrap warning flag (account.sparks not anchored yet). */
export const bootstrapWarnState = { registriesMissing: false }
