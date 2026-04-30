/**
 * `createLogger(subsystem)` — level-gated; `createOpsLogger` for OPS; PERF helpers and tracers live in this module too (`createPerfTracer`, `perfDbRead`, …).
 */

import {
	emitLog,
	getLoggingMode,
	resolveLevel,
	resolveMode,
	setLoggingRuntime,
	setTransport,
} from './core.js'
import { isOpsInfoEnabled, isPerfChannelEnabled } from './log-config.js'
import { applyLogModeFromEnv } from './log-mode.js'
import { createLogger as createSubsystemLogger } from './subsystem-logger.js'
import { createConsoleTransport } from './transports/console.js'

/**
 * OPS channel: server lifecycle, storage backends, CORS, hooks, engine warnings.
 * Subsystem name appears in brackets; stable prefixes for grep and scripts/dev.js.
 * Informational `.log()` lines are gated by `LOG_MODE` (`ops.all`, `ops.sync`, …). `.warn` / `.error` always emit (not gated by `LOG_MODE` or `LOG_LEVEL` level gate).
 */

/** @param {string} subsystem Label inside brackets (e.g. sync, Storage, llm) */
export function createOpsLogger(subsystem) {
	return {
		log: (fmt, ...args) => {
			if (!isOpsInfoEnabled(subsystem)) return
			emitLog('log', subsystem, [fmt, ...args], { applyLevelGate: false })
		},
		warn: (fmt, ...args) => emitLog('warn', subsystem, [fmt, ...args], { applyLevelGate: false }),
		error: (fmt, ...args) => emitLog('error', subsystem, [fmt, ...args], { applyLevelGate: false }),
	}
}

/** Single source for substring checks (orchestration, Error messages, thrown strings). */
export const OPS_PREFIX = {
	sync: '[sync]',
	Storage: '[Storage]',
	STORAGE: '[STORAGE]',
	register: '[register]',
	llm: '[llm]',
	ValidationHook: '[ValidationHook]',
	ActorEngine: '[ActorEngine]',
	ViewEngine: '[ViewEngine]',
	peer: '[peer]',
}

/**
 * If `line` starts with a known OPS bracket prefix, return the subsystem key (matches `createOpsLogger(name)`).
 * @param {string} line
 * @returns {string | null}
 */
export function getOpsSubsystemForPrefixedLine(line) {
	const t = String(line).trimStart()
	for (const [sub, prefix] of Object.entries(OPS_PREFIX)) {
		if (t.startsWith(prefix)) return sub
	}
	return null
}

/**
 * PERF — gated by `LOG_MODE` in dev (`applyLogModeFromEnv`); in-memory only.
 * Lines: `[Perf:scope:name] ...`
 */

/** @param {string} scope @param {string} name */
export function perfStorageKey(scope, name) {
	return `maia:perf:${scope}:${name}`
}

/** @param {string} scope @param {string} name */
export function perfLabel(scope, name) {
	return `${scope}:${name}`
}

/** @param {string} scope @param {string} name */
export function createPerfTracer(scope, name) {
	let _start = null
	const id = perfLabel(scope, name)

	const isEnabled = () => isPerfChannelEnabled(scope, name)

	const line = (msg, extra) => {
		const parts = extra !== undefined && Object.keys(extra).length ? [msg, extra] : [msg]
		emitLog('log', '', parts, { applyLevelGate: false })
	}

	return {
		isEnabled,
		/** @returns {number} */
		now() {
			return isEnabled() ? performance.now() : 0
		},
		start(label = id) {
			if (!isEnabled()) return
			_start = performance.now()
			line(`[Perf:${id}] START ${label}`)
		},
		step(label, extra = {}) {
			if (!isEnabled()) return
			const elapsed = _start != null ? (performance.now() - _start).toFixed(1) : null
			const msg = elapsed != null ? `[Perf:${id}] +${elapsed}ms ${label}` : `[Perf:${id}] ${label}`
			line(msg, Object.keys(extra).length ? extra : undefined)
		},
		end(label) {
			if (!isEnabled()) return
			const elapsed = _start != null ? (performance.now() - _start).toFixed(1) : null
			line(`[Perf:${id}] END ${label} total=${elapsed}ms`)
			_start = null
		},
		/** @param {string} label @param {number} ms @param {Record<string, unknown>} [extra] */
		timing(label, ms, extra = {}) {
			if (!isEnabled()) return
			const suffix = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''
			line(`[Perf:${id}] ${label}: ${ms}ms${suffix}`)
		},
		async measure(label, fn) {
			if (!isEnabled()) return fn()
			const t0 = performance.now()
			const result = await fn()
			const ms = (performance.now() - t0).toFixed(1)
			if (!isEnabled()) return result
			const elapsed = _start != null ? (performance.now() - _start).toFixed(1) : null
			const msg =
				elapsed != null
					? `[Perf:${id}] +${elapsed}ms ${label}: ${ms}ms`
					: `[Perf:${id}] ${label}: ${ms}ms`
			line(msg, undefined)
			return result
		},
	}
}

export const perfEnginesPipeline = createPerfTracer('engines', 'pipeline')
export const perfEnginesChat = createPerfTracer('engines', 'chat')
export const perfDbRead = createPerfTracer('db', 'read')
export const perfDbUpload = createPerfTracer('db', 'upload')
export const perfGameInit = createPerfTracer('game', 'init')
export const perfAppVibes = createPerfTracer('app', 'vibes')
/** Maia DB viewer `renderApp` (data + DOM); enable with `perf.app.maia-db` or `perf.all` */
export const perfAppMaiaDb = createPerfTracer('app', 'maia-db')
/** Account bootstrap handshake (POST /bootstrap + account.sparks anchor + system spark read); enable with `perf.app.bootstrap` or `perf.all`. */
export const perfBootstrap = createPerfTracer('app', 'bootstrap')

export { isStorageOpfsPerfEnabled, logStorageOpfsStep } from './storage-opfs.js'

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
