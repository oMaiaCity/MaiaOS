/**
 * Browser logging env: `LOG_MODE` / `LOG_MODE_PROD` (channels), `LOG_LEVEL`, `NODE_ENV` (runtime + level).
 */

import { resolveLevel, setLoggingRuntime } from './core.js'
import { applyLogModeFromEnv } from './log-mode.js'

/** @typedef {{ LOG_MODE?: string, LOG_LEVEL?: string, LOG_MODE_PROD?: string, NODE_ENV?: string, DEV?: boolean }} MaiaLoggingEnv */

/**
 * @returns {MaiaLoggingEnv}
 */
export function resolveMaiaLoggingEnv() {
	if (typeof window !== 'undefined' && window.__MAIA_DEV_ENV__) {
		return window.__MAIA_DEV_ENV__
	}
	const m =
		typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env === 'object'
			? import.meta.env
			: {}
	return {
		LOG_MODE: m.LOG_MODE ?? '',
		LOG_LEVEL: m.LOG_LEVEL ?? '',
		LOG_MODE_PROD: m.LOG_MODE_PROD ?? '',
		NODE_ENV: m.NODE_ENV ?? (m.DEV === true ? 'development' : 'production'),
		DEV: m.DEV === true,
	}
}

/**
 * @param {MaiaLoggingEnv | null | undefined} env
 */
export function applyMaiaLoggingFromEnv(env) {
	const e = env ?? {}
	const nodeEnv = String(e.NODE_ENV ?? '').trim() || 'development'
	const mode = nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'development'
	const level = resolveLevel(e.LOG_LEVEL, mode)
	setLoggingRuntime({ mode, level })
	const channelMode =
		mode === 'production' ? String(e.LOG_MODE_PROD ?? '').trim() : String(e.LOG_MODE ?? '').trim()
	applyLogModeFromEnv(channelMode)
}
