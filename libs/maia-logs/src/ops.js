/**
 * OPS channel: server lifecycle, storage backends, CORS, hooks, engine warnings.
 * Subsystem name appears in brackets; stable prefixes for grep and scripts/dev.js.
 * Always emitted (not gated by LOG_LEVEL) — channel is operational.
 */

import { emitLog } from './core.js'

/** @param {string} subsystem Label inside brackets (e.g. sync, Storage, llm) */
export function createOpsLogger(subsystem) {
	return {
		log: (fmt, ...args) => emitLog('log', subsystem, [fmt, ...args], { applyLevelGate: false }),
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
