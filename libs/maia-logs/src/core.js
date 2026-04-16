/**
 * Canonical logging runtime: mode, level gate, redaction, ring buffer, transport.
 */

import { createConsoleTransport } from './transports/console.js'

/** @typedef {'development' | 'production' | 'test'} LogModeName */
/** @typedef {'silent' | 'error' | 'warn' | 'info' | 'log' | 'debug'} LogLevelName */

const LEVEL_RANK = { silent: 0, error: 1, warn: 2, info: 3, log: 4, debug: 5 }

const REDACT_PATTERNS = [
	/(Bearer\s+)[^\s]+/gi,
	/(Authorization[:\s]+)[^\s]+/gi,
	/(PEER_SECRET[=\s]+)\S+/gi,
	/(AVEN_MAIA_SECRET[=\s]+)\S+/gi,
	/(RED_PILL_API_KEY[=\s]+)\S+/gi,
]

const RING_MAX = 500
/** @type {{ ts: number, level: string, subsystem: string, parts: unknown[] }[]} */
let _ring = []

/** @typedef {{ write: (level: string, subsystem: string, parts: unknown[]) => void }} MaiaLogTransport */

/** @type {MaiaLogTransport | null} */
let _transport = null

/**
 * First emit installs default console transport + runtime (Node + browser before `applyMaiaLoggingFromEnv`).
 */
function ensureTransportForEmit() {
	if (_transport) return
	const mode = resolveMode()
	const level = resolveLevel(process.env.LOG_LEVEL, mode)
	setLoggingRuntime({ mode, level })
	setTransport(createConsoleTransport({ json: mode === 'production' }))
}

/**
 * @param {unknown} x
 * @returns {unknown}
 */
function redactOne(x) {
	if (typeof x === 'string') {
		let s = x
		for (const re of REDACT_PATTERNS) {
			s = s.replace(re, '$1[redacted]')
		}
		return s
	}
	return x
}

/**
 * @param {unknown[]} args
 * @returns {unknown[]}
 */
export function redact(args) {
	return args.map(redactOne)
}

/**
 * @returns {LogModeName}
 */
export function resolveMode() {
	if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return 'test'
	if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return 'production'
	if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV === false) {
		return 'production'
	}
	return 'development'
}

/**
 * @param {string | undefined | null} raw
 * @returns {LogLevelName}
 */
export function normalizeLevel(raw) {
	const s = String(raw ?? '')
		.trim()
		.toLowerCase()
	const ok = ['silent', 'error', 'warn', 'info', 'log', 'debug']
	return /** @type {LogLevelName} */ (ok.includes(s) ? s : '')
}

/**
 * @param {string | undefined | null} logLevelEnv
 * @param {LogModeName} mode
 * @returns {LogLevelName}
 */
export function resolveLevel(logLevelEnv, mode) {
	const parsed = normalizeLevel(logLevelEnv)
	if (parsed) return parsed
	if (mode === 'test') return 'silent'
	if (mode === 'production') return 'warn'
	return 'debug'
}

/** @type {LogLevelName} */
let _currentLevel = 'debug'
/** @type {LogModeName} */
let _currentMode = 'development'

/**
 * @param {{ mode: LogModeName, level: LogLevelName }} s
 */
export function setLoggingRuntime(s) {
	_currentMode = s.mode
	_currentLevel = s.level
}

/**
 * @returns {LogModeName}
 */
export function getLoggingMode() {
	return _currentMode
}

/**
 * @returns {LogLevelName}
 */
export function getLoggingLevel() {
	return _currentLevel
}

/**
 * @param {string} levelName
 * @returns {boolean}
 */
export function shouldLog(levelName) {
	const need = LEVEL_RANK[/** @type {keyof typeof LEVEL_RANK} */ (levelName)] ?? 0
	const have = LEVEL_RANK[_currentLevel] ?? 0
	return need <= have
}

/**
 * @param {string} level
 * @param {string} subsystem
 * @param {unknown[]} parts
 * @param {{ applyLevelGate?: boolean }} [opts] — `applyLevelGate` false for OPS and for PERF/DEBUG/TRACE after channel gating (LOG_MODE), so they are not double-gated by LOG_LEVEL.
 */
export function emitLog(level, subsystem, parts, opts = {}) {
	ensureTransportForEmit()
	const applyLevelGate = opts.applyLevelGate !== false
	if (applyLevelGate && !shouldLog(level)) return
	const safe = redact(parts)
	const entry = { ts: Date.now(), level, subsystem, parts: safe }
	_ring.push(entry)
	if (_ring.length > RING_MAX) _ring = _ring.slice(-RING_MAX)
	const t = _transport
	if (!t) return
	t.write(level, subsystem, safe)
}

/**
 * @param {MaiaLogTransport | null} t
 */
export function setTransport(t) {
	_transport = t
}

/**
 * @returns {MaiaLogTransport | null}
 */
export function getTransport() {
	return _transport
}

/**
 * @returns {readonly { ts: number, level: string, subsystem: string, parts: unknown[] }[]}
 */
export function getRecentLogs() {
	return _ring
}
