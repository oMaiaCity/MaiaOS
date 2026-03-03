/**
 * Performance logging for upload/store audit.
 * Enable: localStorage.setItem('maia:perf:upload', '1')
 * Disable: localStorage.removeItem('maia:perf:upload')
 */

const getNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function isEnabled() {
	if (typeof window === 'undefined') return false
	// localhost OR dev. Else: localStorage.setItem('maia:perf:upload', '1')
	return (
		window.location?.hostname === 'localhost' ||
		import.meta?.env?.DEV ||
		localStorage?.getItem('maia:perf:upload') === '1'
	)
}

/** Start a span; returns start time to pass to perfEnd. */
export function perfStart() {
	return getNow()
}

let _auditStarted = false
/** Log elapsed time for a step. */
export function perfEnd(start, step, extra = {}) {
	if (!isEnabled()) return
	if (!_auditStarted) {
		_auditStarted = true
		console.log(
			'[Perf] === Upload/Store audit (disable: localStorage.removeItem("maia:perf:upload")) ===',
		)
	}
	const elapsed = Math.round((getNow() - start) * 100) / 100
	const extraStr = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''
	console.log(`[Perf] ${step}: ${elapsed}ms${extraStr}`)
}

/** Log a point-in-time mark (e.g. "step X done"). */
export function perfMark(step, extra = {}) {
	if (!isEnabled()) return
	if (!_auditStarted) {
		_auditStarted = true
		console.log(
			'[Perf] === Upload/Store audit (disable: localStorage.removeItem("maia:perf:upload")) ===',
		)
	}
	const extraStr = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''
	console.log(`[Perf] ${step}${extraStr}`)
}
