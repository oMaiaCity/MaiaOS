/**
 * OPS channel: server lifecycle, storage backends, CORS, hooks, engine warnings.
 * Subsystem name appears in brackets; stable prefixes for grep and scripts/dev.js.
 */

/** @param {string} subsystem Label inside brackets (e.g. sync, Storage, llm) */
export function createOpsLogger(subsystem) {
	const tag = `[${subsystem}]`
	return {
		log: (fmt, ...args) => console.log(`${tag} ${fmt}`, ...args),
		warn: (fmt, ...args) => console.warn(`${tag} ${fmt}`, ...args),
		error: (fmt, ...args) => console.error(`${tag} ${fmt}`, ...args),
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
