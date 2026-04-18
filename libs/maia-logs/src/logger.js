/**
 * `createLogger(subsystem)` — level-gated; `createOpsLogger` for OPS (informational `.log` gated by `LOG_MODE`; `.warn`/`.error` always emit).
 */

import {
	emitLog,
	getLoggingMode,
	resolveLevel,
	resolveMode,
	setLoggingRuntime,
	setTransport,
} from './core.js'
import { applyLogModeFromEnv } from './log-mode.js'
import { createPerfTracer } from './perf.js'
import { createConsoleTransport } from './transports/console.js'

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
		/** Positive completion (pretty console: `app`/`sync` = green message, colored `[prefix]`; `dev` = grey; same gate as `.log`). */
		success: (...args) => emitLog('success', subsystem, args, { applyLevelGate }),
		debug: (...args) => {
			if (globalThis.__MAIA_STRIP__ === false) return
			if (globalThis.__MAIA_DEBUG__ === false) return
			emitLog('debug', subsystem, args, { applyLevelGate })
		},
		/**
		 * @param {string} name
		 */
		perf: (name) => createPerfTracer(subsystem, name),
		/**
		 * @param {string} sub
		 */
		child: (sub) => createLogger(subsystem ? `${subsystem}:${sub}` : sub, opts),
	}
}

/**
 * Installs default console transport from current `getLoggingMode()` (pretty dev, JSON prod).
 */
export function installDefaultTransport() {
	setTransport(createConsoleTransport({ json: getLoggingMode() === 'production' }))
}

/**
 * Optional explicit bootstrap (same as first `emitLog`); use when you need transport before any log.
 */
export function bootstrapNodeLogging() {
	const mode = resolveMode()
	const level = resolveLevel(process.env.LOG_LEVEL, mode)
	setLoggingRuntime({ mode, level })
	installDefaultTransport()
	applyLogModeFromEnv(process.env.LOG_MODE ?? '')
}
