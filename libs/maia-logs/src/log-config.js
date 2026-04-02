/**
 * In-memory gates for PERF / TRACE / DEBUG — set only by `applyLogModeFromEnv` (`LOG_MODE` from `/__maia_env`).
 * No localStorage, no URL params (avoids stale browser flags).
 */

/** @type {Set<string>} */
let _perfChannels = new Set()
/** @type {Set<string>} */
let _debugChannels = new Set()
let _traceEnabled = false

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
 * @param {{ perfKeys: string[], debugKeys?: string[], trace: boolean }} opts - keys are `scope:name` (lowercased in set)
 */
export function setLogModeState(opts) {
	_perfChannels = new Set(opts.perfKeys.map((k) => k.toLowerCase()))
	_debugChannels = new Set((opts.debugKeys ?? []).map((k) => k.toLowerCase()))
	_traceEnabled = opts.trace
}
