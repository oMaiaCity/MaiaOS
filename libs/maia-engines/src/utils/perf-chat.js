/**
 * Profiling for chat user-message path: form submit → inbox → op.create → costream.
 * Enable: localStorage.setItem('maia:perf:chat', '1')
 * Disable: localStorage.removeItem('maia:perf:chat')
 */

function isEnabled() {
	if (typeof window === 'undefined') return false
	try {
		return localStorage?.getItem('maia:perf:chat') === '1'
	} catch {
		return false
	}
}

let _traceStart = null

export function perfChatStart(label) {
	if (!isEnabled()) return
	if (_traceStart == null) {
		_traceStart = performance.now()
		console.log(`[Perf:chat] START ${label}`)
	}
}

export function perfChatStep(label, extra = {}) {
	if (!isEnabled()) return
	const elapsed =
		_traceStart != null ? Math.round((performance.now() - _traceStart) * 100) / 100 : null
	const msg = elapsed != null ? `[Perf:chat] +${elapsed}ms ${label}` : `[Perf:chat] ${label}`
	console.log(msg, Object.keys(extra).length ? extra : '')
}

export function perfChatEnd(label) {
	if (!isEnabled()) return
	const elapsed =
		_traceStart != null ? Math.round((performance.now() - _traceStart) * 100) / 100 : null
	console.log(`[Perf:chat] END ${label} total=${elapsed}ms`)
	_traceStart = null
}

/** Measure a single async operation, log duration */
export async function perfChatMeasure(label, fn) {
	if (!isEnabled()) return fn()
	const t0 = performance.now()
	const result = await fn()
	const ms = Math.round((performance.now() - t0) * 100) / 100
	console.log(`[Perf:chat] ${label}: ${ms}ms`)
	return result
}
