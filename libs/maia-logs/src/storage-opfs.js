/**
 * Shallow logging for the OPFS storage adapter: core + log-config + subsystem-logger only.
 * Keeps import depth off the full logger stack (OPS, PERF tracers, process guards).
 */

import { emitLog } from './core.js'
import { isPerfChannelEnabled } from './log-config.js'
import { createLogger } from './subsystem-logger.js'

/** Logger namespace used by libs/maia-storage OPFS implementation */
export const storageOpfsLog = createLogger('storage-opfs')

/** @returns {boolean} */
export function isStorageOpfsPerfEnabled() {
	return isPerfChannelEnabled('storage', 'opfs')
}

/**
 * @param {string} step
 * @param {number} ms
 * @param {Record<string, unknown>} [extra]
 */
export function logStorageOpfsStep(step, ms, extra = {}) {
	if (!isStorageOpfsPerfEnabled()) return
	const suffix = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''
	emitLog('log', '', [`[Perf:storage:opfs] OPFS.${step}: ${ms}ms${suffix}`], {
		applyLevelGate: false,
	})
}
