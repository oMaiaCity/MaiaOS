/**
 * Pipeline perf: selection/detail loading path (view click → inbox → process → tell).
 * Default: OFF. Enable: localStorage.setItem('maia:perf:pipeline', '1')
 */

function isEnabled() {
	if (typeof window === 'undefined') return false
	try {
		const explicit = localStorage?.getItem('maia:perf:pipeline')
		return explicit === '1'
	} catch {
		return false
	}
}

let _traceStart = null

export function perfPipelineStart(label = 'pipeline') {
	if (!isEnabled()) return
	_traceStart = performance.now()
	console.log(`[Perf:pipeline] START ${label}`)
}

export function perfPipelineStep(label, extra = {}) {
	if (!isEnabled()) return
	const elapsed =
		_traceStart != null ? Math.round((performance.now() - _traceStart) * 100) / 100 : null
	const msg = elapsed != null ? `[Perf:pipeline] +${elapsed}ms ${label}` : `[Perf:pipeline] ${label}`
	console.log(msg, Object.keys(extra).length ? extra : '')
}

export async function perfPipelineMeasure(label, fn) {
	if (!isEnabled()) return fn()
	const t0 = performance.now()
	const result = await fn()
	const ms = Math.round((performance.now() - t0) * 100) / 100
	perfPipelineStep(`${label}: ${ms}ms`)
	return result
}
