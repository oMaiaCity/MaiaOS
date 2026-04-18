/**
 * Single selector **`LOG_MODE`** for PERF / TRACE / DEBUG / OPS info / dev orchestrator (root `.env` → `/__maia_env` → `applyLogModeFromEnv`, or `import.meta.env.LOG_MODE` from the prod banner).
 *
 * Tokens (comma / semicolon / whitespace separated):
 * - **`perf.all`** — all PERF channels
 * - **`perf.scope.subscope`** — e.g. `perf.engines.pipeline`, `perf.app.vibes`, `perf.storage.opfs`
 * - **`scope:subscope`** — granular PERF (e.g. `engines:pipeline`)
 * - **`debug.all`** — all DEBUG channels (`engines:loadBinary`, `app:cobinary`, …)
 * - **`debug.scope.name`** — e.g. `debug.engines.loadBinary`, `debug.app.cobinary`
 * - **`trace.all`** / **`trace.scope`** — TRACE on
 * - **`ops.all`** — informational `createOpsLogger(sub).log()` for all OPS subsystems (`.warn` / `.error` always on)
 * - **`ops.subsystem`** — e.g. `ops.sync`, `ops.storage` (matches `createOpsLogger` name case-insensitively)
 * - **`dev.verbose`** — root `bun dev` forwards child process lines (Vite / sync) like split terminals
 *
 * - **Empty** `LOG_MODE` on **Node** (sync, CLI): informational OPS **`.log()`** defaults **on** in development (`NODE_ENV` not `production` / `test`) so you see `[sync] Listening…` without extra flags. **Browser**: empty → OPS info off (no `process.versions.node`).
 * - **`dev.verbose`** also turns on **`ops.all`** so spawned sync/app children emit OPS lines (needed for `bun dev` “Ready - …” detection).
 * - Explicit **`off`** / **`none`** / **`0`** / **`false`** → everything off, including OPS info.
 */

import { setLogModeState } from './log-config.js'

/** Empty LOG_MODE: enable OPS `.log()` on Node in local dev only (not production/test, not browser). */
function nodeDefaultOpsAllWhenEmpty() {
	if (typeof process === 'undefined' || !process.versions?.node) return false
	const ne = process.env.NODE_ENV
	if (ne === 'production' || ne === 'test') return false
	return true
}

const TOKEN_SPLIT = /[,;\s]+/

/** `perf.scope.subscope` → `scope:subscope` */
const PERF_DOT = /^perf\.([^.]+)\.(.+)$/i

/** `debug.scope.name` → `scope:name` */
const DEBUG_DOT = /^debug\.([^.]+)\.(.+)$/i

/** `ops.subsystem` → subsystem (lowercased) */
const OPS_DOT = /^ops\.([^.]+)$/i

const PERF_ALL_KEYS = [
	'engines:pipeline',
	'engines:chat',
	'db:upload',
	'storage:opfs',
	'game:init',
	'app:vibes',
	'app:maia-db',
]

const DEBUG_ALL_KEYS = [
	'engines:loadbinary',
	'app:cobinary',
	'app:maia-db',
	'engines:runtime',
	'db:storagehook',
]

/**
 * @param {string | undefined | null} value
 */
export function applyLogModeFromEnv(value) {
	const raw = value == null ? '' : String(value).trim()
	const tl = raw.toLowerCase()
	// Explicit "all logging off" — not the same as empty string (see below).
	if (tl === 'off' || tl === 'none' || tl === 'false' || tl === '0') {
		setLogModeState({
			perfKeys: [],
			debugKeys: [],
			trace: false,
			opsKeys: [],
			opsAll: false,
			devVerbose: false,
		})
		return
	}

	if (!raw) {
		setLogModeState({
			perfKeys: [],
			debugKeys: [],
			trace: false,
			opsKeys: [],
			opsAll: nodeDefaultOpsAllWhenEmpty(),
			devVerbose: false,
		})
		return
	}

	const tokens = raw
		.split(TOKEN_SPLIT)
		.map((t) => t.trim())
		.filter(Boolean)
	if (tokens.length === 0) {
		setLogModeState({
			perfKeys: [],
			debugKeys: [],
			trace: false,
			opsKeys: [],
			opsAll: nodeDefaultOpsAllWhenEmpty(),
			devVerbose: false,
		})
		return
	}

	let perfAll = false
	let debugAll = false
	let traceAll = false
	let opsAll = false
	let devVerbose = false
	/** @type {string[]} */
	const perfGranular = []
	/** @type {string[]} */
	const debugGranular = []
	/** @type {string[]} */
	const opsGranular = []

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
		if (low === 'ops.all') {
			opsAll = true
			continue
		}
		if (low === 'dev.verbose') {
			devVerbose = true
			// Orchestrator pipes child output; sync must still emit OPS lines (e.g. Listening) for readiness + parity with split terminals.
			opsAll = true
			continue
		}
		const mOps = OPS_DOT.exec(t)
		if (mOps) {
			opsGranular.push(mOps[1].toLowerCase())
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

	setLogModeState({
		perfKeys,
		debugKeys,
		trace: traceAll,
		opsKeys: opsGranular,
		opsAll,
		devVerbose,
	})
}

/**
 * Resolved `LOG_MODE` string: dev server sets `window.__MAIA_DEV_ENV__`; otherwise build banner `import.meta.env.LOG_MODE` (default `''` → all channels off).
 * @returns {string}
 */
export function resolveMaiaLogMode() {
	if (typeof window !== 'undefined' && window.__MAIA_DEV_ENV__) {
		return String(window.__MAIA_DEV_ENV__.LOG_MODE ?? '')
	}
	const m =
		typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env === 'object'
			? import.meta.env
			: {}
	return String(m.LOG_MODE ?? '')
}
