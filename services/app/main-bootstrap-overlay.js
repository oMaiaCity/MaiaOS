import {
	BOOTSTRAP_PHASES,
	resetBootstrapPhase,
	subscribeBootstrapPhase,
} from '@AvenOS/kernel/client'

/**
 * User-facing subtitle shown in the loading overlay, keyed by bootstrap phase.
 * Keep terse + human-friendly; the phase id is the source of truth for diagnostics/tests.
 */
const BOOTSTRAP_PHASE_SUBTITLES = Object.freeze({
	[BOOTSTRAP_PHASES.INIT]: 'Setting up your sovereign self…',
	[BOOTSTRAP_PHASES.CONNECTING_SYNC]: 'Connecting to sync…',
	[BOOTSTRAP_PHASES.LOADING_ACCOUNT]: 'Loading account…',
	[BOOTSTRAP_PHASES.HANDSHAKE]: 'Handshaking with sync server…',
	[BOOTSTRAP_PHASES.ANCHORING_SPARKS]: 'Anchoring sparks…',
	[BOOTSTRAP_PHASES.READING_SYSTEM_SPARK]: 'Resolving system spark…',
	[BOOTSTRAP_PHASES.INITIALIZING_MAIADB]: 'Initializing MaiaDB…',
	[BOOTSTRAP_PHASES.READY]: 'Ready.',
	[BOOTSTRAP_PHASES.FAILED]: 'Bootstrap failed.',
})

let _bootstrapPhaseUnsub = null

function applyBootstrapPhaseToOverlay(phase) {
	const subtitleEl = document.querySelector('.loading-connecting-subtitle')
	if (!subtitleEl) return
	const text = BOOTSTRAP_PHASE_SUBTITLES[phase]
	if (text) subtitleEl.textContent = text
}

/**
 * Subscribe bootstrap phase events to the visible loading overlay subtitle.
 * Also resets phase state so each sign-in / sign-up starts from INIT.
 */
export function startBootstrapPhaseOverlay() {
	resetBootstrapPhase()
	if (_bootstrapPhaseUnsub) _bootstrapPhaseUnsub()
	_bootstrapPhaseUnsub = subscribeBootstrapPhase(({ phase }) => applyBootstrapPhaseToOverlay(phase))
}

export function stopBootstrapPhaseOverlay() {
	if (_bootstrapPhaseUnsub) {
		_bootstrapPhaseUnsub()
		_bootstrapPhaseUnsub = null
	}
}
