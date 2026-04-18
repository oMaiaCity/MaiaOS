/**
 * Bootstrap phase telemetry + typed error.
 *
 * Single observable channel for the linear bootstrap sequence (connect → handshake → anchor → read °maia → init MaiaDB → ready).
 * Integrates with `@MaiaOS/logs` perfBootstrap for gated timing; UI subscribers get live phase transitions.
 */

import { perfBootstrap } from '@MaiaOS/logs'

export const BOOTSTRAP_PHASES = Object.freeze({
	INIT: 'init',
	CONNECTING_SYNC: 'connecting_sync',
	LOADING_ACCOUNT: 'loading_account',
	HANDSHAKE: 'handshake',
	ANCHORING_SPARKS: 'anchoring_sparks',
	READING_SYSTEM_SPARK: 'reading_system_spark',
	INITIALIZING_MAIADB: 'initializing_maiadb',
	READY: 'ready',
	FAILED: 'failed',
})

let _phase = BOOTSTRAP_PHASES.INIT
const _listeners = new Set()

/**
 * Transition to a new phase. Emits to all subscribers + perfBootstrap.step.
 * @param {string} phase - one of BOOTSTRAP_PHASES
 * @param {Record<string, unknown>} [detail]
 */
export function setBootstrapPhase(phase, detail = {}) {
	_phase = phase
	try {
		perfBootstrap.step(phase, detail)
	} catch (_e) {
		/* perf is best-effort */
	}
	for (const l of _listeners) {
		try {
			l({ phase, detail })
		} catch (_e) {
			/* subscriber error must not break bootstrap */
		}
	}
}

/**
 * Subscribe to phase transitions. Returns unsubscribe.
 * @param {(state: { phase: string, detail: Record<string, unknown> }) => void} fn
 */
export function subscribeBootstrapPhase(fn) {
	_listeners.add(fn)
	return () => _listeners.delete(fn)
}

/** @returns {string} */
export function getBootstrapPhase() {
	return _phase
}

/**
 * Reset to INIT and start the perf timer. Call once at the top of each auth entry point.
 */
export function resetBootstrapPhase() {
	_phase = BOOTSTRAP_PHASES.INIT
	try {
		perfBootstrap.start('bootstrap')
	} catch (_e) {
		/* perf is best-effort */
	}
}

/**
 * Typed error with the failing phase attached. Automatically emits FAILED on construction.
 */
export class BootstrapError extends Error {
	/**
	 * @param {string} phase - phase where failure occurred (BOOTSTRAP_PHASES value)
	 * @param {string} message
	 * @param {{ cause?: unknown, retryable?: boolean }} [opts]
	 */
	constructor(phase, message, { cause, retryable = false } = {}) {
		super(message)
		this.name = 'BootstrapError'
		this.phase = phase
		this.cause = cause
		this.retryable = retryable
		setBootstrapPhase(BOOTSTRAP_PHASES.FAILED, { failedPhase: phase, message })
	}
}
