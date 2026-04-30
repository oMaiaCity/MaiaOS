/**
 * `createLogger` without PERF / OPS bootstrap deps — depends only on `./core.js`.
 * Use from foundation layers (e.g. @MaiaOS/db) to keep import depth shallow.
 */

import { emitLog } from './core.js'

/**
 * @param {string} subsystem
 * @param {{ applyLevelGate?: boolean }} [opts]
 */
export function createLogger(subsystem, opts = {}) {
	const applyLevelGate = opts.applyLevelGate !== false
	return {
		error: (...args) => emitLog('error', subsystem, args, { applyLevelGate }),
		warn: (...args) => emitLog('warn', subsystem, args, { applyLevelGate }),
		info: (...args) => emitLog('info', subsystem, args, { applyLevelGate }),
		log: (...args) => emitLog('log', subsystem, args, { applyLevelGate }),
		success: (...args) => emitLog('success', subsystem, args, { applyLevelGate }),
		debug: (...args) => {
			if (globalThis.__MAIA_STRIP__ === false) return
			if (globalThis.__MAIA_DEBUG__ === false) return
			emitLog('debug', subsystem, args, { applyLevelGate })
		},
		child: (sub) => createLogger(subsystem ? `${subsystem}:${sub}` : sub, opts),
	}
}
