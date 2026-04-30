/**
 * `createLogger(subsystem)` — level-gated; `createOpsLogger` for OPS (informational `.log` gated by `LOG_MODE`; `.warn`/`.error` always emit).
 */

import {
	getLoggingMode,
	resolveLevel,
	resolveMode,
	setLoggingRuntime,
	setTransport,
} from './core.js'
import { applyLogModeFromEnv } from './log-mode.js'
import { createOpsLogger } from './ops.js'
import { createPerfTracer } from './perf.js'
import { createLogger as createSubsystemLogger } from './subsystem-logger.js'
import { createConsoleTransport } from './transports/console.js'

/** Known-transient PG driver errors that should not take down a long-running server. */
const BENIGN_ERROR_CODES = new Set(['ERR_POSTGRES_IDLE_TIMEOUT', 'ERR_POSTGRES_CONNECTION_CLOSED'])

let processGuardsInstalled = false

/**
 * @param {unknown} reason
 * @returns {Error}
 */
function normalizeRejectionReason(reason) {
	if (reason instanceof Error) return reason
	const err = new Error(String(reason))
	if (reason && typeof reason === 'object' && 'code' in reason) {
		err.code = /** @type {{ code?: string }} */ (reason).code
	}
	return err
}

function installProcessGuards() {
	if (processGuardsInstalled || typeof process === 'undefined') return
	processGuardsInstalled = true
	const ops = createOpsLogger('process')
	const handle = (kind) => (err) => {
		const code = err?.code
		if (BENIGN_ERROR_CODES.has(code)) {
			ops.warn(`${kind} (benign, continuing):`, code, err?.message)
			return
		}
		ops.error(`${kind} (fatal):`, err?.stack ?? err)
		process.exit(1)
	}
	process.on('uncaughtException', handle('uncaughtException'))
	process.on('unhandledRejection', (reason) => {
		handle('unhandledRejection')(normalizeRejectionReason(reason))
	})
}

/**
 * @param {string} subsystem
 * @param {{ applyLevelGate?: boolean }} [opts]
 */
export function createLogger(subsystem, opts = {}) {
	const base = createSubsystemLogger(subsystem, opts)
	return {
		...base,
		perf: (name) => createPerfTracer(subsystem, name),
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
	installProcessGuards()
}
