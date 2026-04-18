/**
 * OPS channel: server lifecycle, storage backends, CORS, hooks, engine warnings.
 * Subsystem name appears in brackets; stable prefixes for grep and scripts/dev.js.
 * Informational `.log()` lines are gated by `LOG_MODE` (`ops.all`, `ops.sync`, …). `.warn` / `.error` always emit (not gated by `LOG_MODE` or `LOG_LEVEL` level gate).
 */

import { emitLog } from './core.js'
import { isOpsInfoEnabled } from './log-config.js'

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
