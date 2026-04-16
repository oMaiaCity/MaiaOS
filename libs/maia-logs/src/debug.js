/**
 * DEBUG — gated by `LOG_MODE` (`debug.all` or `debug.scope.name`); in-memory only.
 */

import { emitLog } from './core.js'
import { isDebugChannelEnabled } from './log-config.js'

/**
 * @param {string} scope
 * @param {string} name
 * @param {...unknown} args
 */
export function debugLog(scope, name, ...args) {
	if (!isDebugChannelEnabled(scope, name)) return
	const id = `${scope}:${name}`
	emitLog('debug', '', [`[Debug:${id}]`, ...args], { applyLevelGate: false })
}

/**
 * @param {string} scope
 * @param {string} name
 * @param {...unknown} args
 */
export function debugWarn(scope, name, ...args) {
	if (!isDebugChannelEnabled(scope, name)) return
	const id = `${scope}:${name}`
	emitLog('warn', '', [`[Debug:${id}]`, ...args], { applyLevelGate: false })
}
