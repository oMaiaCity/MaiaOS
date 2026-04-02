/**
 * DEBUG — gated by `LOG_MODE` (`debug.all` or `debug.scope.name`); in-memory only.
 */

import { isDebugChannelEnabled } from './log-config.js'

/**
 * @param {string} scope
 * @param {string} name
 * @param {...unknown} args
 */
export function debugLog(scope, name, ...args) {
	if (!isDebugChannelEnabled(scope, name)) return
	const id = `${scope}:${name}`
	console.log(`[Debug:${id}]`, ...args)
}

/**
 * @param {string} scope
 * @param {string} name
 * @param {...unknown} args
 */
export function debugWarn(scope, name, ...args) {
	if (!isDebugChannelEnabled(scope, name)) return
	const id = `${scope}:${name}`
	console.warn(`[Debug:${id}]`, ...args)
}
