/**
 * Single dev control: `LOG_MODE` (root `.env` → `/__maia_env` → in-memory state only).
 *
 * Tokens (comma / semicolon / whitespace separated):
 * - **`perf.all`** — all PERF channels
 * - **`perf.scope.subscope`** — e.g. `perf.engines.pipeline`, `perf.app.vibes`, `perf.storage.opfs`
 * - **`scope:subscope`** — granular PERF (e.g. `engines:pipeline`)
 * - **`debug.all`** — all DEBUG channels (`engines:loadBinary`, `app:cobinary`, …)
 * - **`debug.scope.name`** — e.g. `debug.engines.loadBinary`, `debug.app.cobinary`
 * - **`trace.all`** / **`trace.scope`** — TRACE on
 *
 * Empty / `off` / `none` / `0` / `false` → PERF, DEBUG, and TRACE off (does not read localStorage).
 */

import { setLogModeState } from './log-config.js'

const TOKEN_SPLIT = /[,;\s]+/

/** `perf.scope.subscope` → `scope:subscope` */
const PERF_DOT = /^perf\.([^.]+)\.(.+)$/i

/** `debug.scope.name` → `scope:name` */
const DEBUG_DOT = /^debug\.([^.]+)\.(.+)$/i

const PERF_ALL_KEYS = [
	'engines:pipeline',
	'engines:chat',
	'db:upload',
	'storage:opfs',
	'game:init',
	'app:vibes',
]

const DEBUG_ALL_KEYS = ['engines:loadbinary', 'app:cobinary', 'engines:runtime', 'db:storagehook']

/**
 * @param {string | undefined | null} value
 */
export function applyLogModeFromEnv(value) {
	const raw = value == null ? '' : String(value).trim()
	const tl = raw.toLowerCase()
	if (!raw || tl === 'off' || tl === 'none' || tl === 'false' || tl === '0') {
		setLogModeState({ perfKeys: [], debugKeys: [], trace: false })
		return
	}

	const tokens = raw
		.split(TOKEN_SPLIT)
		.map((t) => t.trim())
		.filter(Boolean)
	if (tokens.length === 0) {
		setLogModeState({ perfKeys: [], debugKeys: [], trace: false })
		return
	}

	let perfAll = false
	let debugAll = false
	let traceAll = false
	/** @type {string[]} */
	const perfGranular = []
	/** @type {string[]} */
	const debugGranular = []

	for (const tok of tokens) {
		const t = tok.trim()
		if (!t) continue
		const low = t.toLowerCase()
		if (low === 'perf.all') {
			perfAll = true
			continue
		}
		if (low === 'debug.all') {
			debugAll = true
			continue
		}
		if (low === 'trace.all' || low === 'trace.scope') {
			traceAll = true
			continue
		}
		const mPerf = PERF_DOT.exec(t)
		if (mPerf) {
			perfGranular.push(`${mPerf[1].toLowerCase()}:${mPerf[2].toLowerCase()}`)
			continue
		}
		const mDbg = DEBUG_DOT.exec(t)
		if (mDbg) {
			debugGranular.push(`${mDbg[1].toLowerCase()}:${mDbg[2].toLowerCase()}`)
			continue
		}
		if (t.includes(':')) {
			perfGranular.push(t.toLowerCase())
		}
	}

	/** @type {string[]} */
	let perfKeys = []
	if (perfAll) perfKeys = [...PERF_ALL_KEYS]
	else perfKeys = [...perfGranular]

	/** @type {string[]} */
	let debugKeys = []
	if (debugAll) debugKeys = [...DEBUG_ALL_KEYS]
	else debugKeys = [...debugGranular]

	setLogModeState({ perfKeys, debugKeys, trace: traceAll })
}
