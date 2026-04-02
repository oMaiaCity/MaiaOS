/**
 * PERF — gated by `LOG_MODE` in dev (`applyLogModeFromEnv`); in-memory only.
 * Console: `[Perf:scope:name] ...`
 */

import { isPerfChannelEnabled } from './log-config.js'

/**
 * @param {string} scope
 * @param {string} name
 * @returns {string} documentation only (not used for gating)
 */
export function perfStorageKey(scope, name) {
	return `maia:perf:${scope}:${name}`
}

/**
 * @param {string} scope
 * @param {string} name
 * @returns {string}
 */
export function perfLabel(scope, name) {
	return `${scope}:${name}`
}

/**
 * @param {string} scope
 * @param {string} name
 */
export function createPerfTracer(scope, name) {
	let _start = null
	const id = perfLabel(scope, name)

	const isEnabled = () => isPerfChannelEnabled(scope, name)

	return {
		isEnabled,
		/** @returns {number} */
		now() {
			return isEnabled() ? performance.now() : 0
		},
		start(label = id) {
			if (!isEnabled()) return
			_start = performance.now()
			console.log(`[Perf:${id}] START ${label}`)
		},
		step(label, extra = {}) {
			if (!isEnabled()) return
			const elapsed = _start != null ? (performance.now() - _start).toFixed(1) : null
			const msg = elapsed != null ? `[Perf:${id}] +${elapsed}ms ${label}` : `[Perf:${id}] ${label}`
			console.log(msg, Object.keys(extra).length ? extra : '')
		},
		end(label) {
			if (!isEnabled()) return
			const elapsed = _start != null ? (performance.now() - _start).toFixed(1) : null
			console.log(`[Perf:${id}] END ${label} total=${elapsed}ms`)
			_start = null
		},
		/** @param {string} label @param {number} ms @param {Record<string, unknown>} [extra] */
		timing(label, ms, extra = {}) {
			if (!isEnabled()) return
			const suffix = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''
			console.log(`[Perf:${id}] ${label}: ${ms}ms${suffix}`)
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
			console.log(msg, '')
			return result
		},
	}
}

export const perfEnginesPipeline = createPerfTracer('engines', 'pipeline')
export const perfEnginesChat = createPerfTracer('engines', 'chat')
export const perfDbUpload = createPerfTracer('db', 'upload')
export const perfGameInit = createPerfTracer('game', 'init')
export const perfAppVibes = createPerfTracer('app', 'vibes')
/** Maia DB viewer `renderApp` (data + DOM); enable with `perf.app.maia-db` or `perf.all` */
export const perfAppMaiaDb = createPerfTracer('app', 'maia-db')

/**
 * @returns {boolean}
 */
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
	console.log(`[Perf:storage:opfs] OPFS.${step}: ${ms}ms${suffix}`)
}
