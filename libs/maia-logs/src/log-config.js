/**
 * In-memory gates for PERF / TRACE / DEBUG / OPS info / dev orchestrator — set only by `applyLogModeFromEnv` (`LOG_MODE` from `/__maia_env` or `import.meta.env`).
 * No localStorage, no URL params (avoids stale browser flags).
 */

/** @type {Set<string>} */
let _perfChannels = new Set()
/** @type {Set<string>} */
let _debugChannels = new Set()
let _traceEnabled = false
/** @type {Set<string>} */
let _opsChannels = new Set()
let _opsAll = false
let _devVerbose = false

/**
 * @param {string} scope
 * @param {string} name
 * @returns {boolean}
 */
export function isPerfChannelEnabled(scope, name) {
	return _perfChannels.has(`${scope}:${name}`.toLowerCase())
}

/**
 * @param {string} scope
 * @param {string} name
 * @returns {boolean}
 */
export function isDebugChannelEnabled(scope, name) {
	return _debugChannels.has(`${scope}:${name}`.toLowerCase())
}

/**
 * @returns {boolean}
 */
export function isTraceEnabledFromConfig() {
	return _traceEnabled
}

/**
 * Informational OPS `.log()` lines — gated by `LOG_MODE` (`ops.all`, `ops.sync`, …). `.warn` / `.error` always emit.
 * @param {string} subsystem — same string passed to `createOpsLogger(subsystem)`; matched lowercased.
 * @returns {boolean}
 */
export function isOpsInfoEnabled(subsystem) {
	if (_opsAll) return true
	const s = String(subsystem ?? '').toLowerCase()
	return _opsChannels.has(s)
}

/**
 * `LOG_MODE` token `dev.verbose` — `bun dev` forwards child stdout/stderr (see `scripts/dev.js`).
 * @returns {boolean}
 */
export function isDevVerboseEnabled() {
	return _devVerbose
}

/**
 * @param {{
 *   perfKeys: string[]
 *   debugKeys?: string[]
 *   trace: boolean
 *   opsKeys?: string[]
 *   opsAll?: boolean
 *   devVerbose?: boolean
 * }} opts - perf/debug keys are `scope:name` (lowercased in set); ops keys are subsystem names lowercased
 */
export function setLogModeState(opts) {
	_perfChannels = new Set(opts.perfKeys.map((k) => k.toLowerCase()))
	_debugChannels = new Set((opts.debugKeys ?? []).map((k) => k.toLowerCase()))
	_traceEnabled = opts.trace
	_opsChannels = new Set((opts.opsKeys ?? []).map((k) => k.toLowerCase()))
	_opsAll = opts.opsAll === true
	_devVerbose = opts.devVerbose === true
}
