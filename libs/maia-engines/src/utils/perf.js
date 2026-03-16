/**
 * Unified performance tracers. Enable via localStorage: setItem('maia:perf:{key}', '1')
 * Keys: pipeline, chat, upload
 */

function createPerfTracer(key) {
	const isEnabled = () =>
		typeof localStorage !== 'undefined' && localStorage.getItem(`maia:perf:${key}`) === '1'
	let _start = null

	return {
		start(label = key) {
			if (!isEnabled()) return
			_start = performance.now()
			console.log(`[Perf:${key}] START ${label}`)
		},
		step(label, extra = {}) {
			if (!isEnabled()) return
			const elapsed = _start != null ? (performance.now() - _start).toFixed(1) : null
			const msg = elapsed != null ? `[Perf:${key}] +${elapsed}ms ${label}` : `[Perf:${key}] ${label}`
			console.log(msg, Object.keys(extra).length ? extra : '')
		},
		end(label) {
			if (!isEnabled()) return
			const elapsed = _start != null ? (performance.now() - _start).toFixed(1) : null
			console.log(`[Perf:${key}] END ${label} total=${elapsed}ms`)
			_start = null
		},
		async measure(label, fn) {
			if (!isEnabled()) return fn()
			const t0 = performance.now()
			const result = await fn()
			const ms = (performance.now() - t0).toFixed(1)
			this.step(`${label}: ${ms}ms`)
			return result
		},
	}
}

export const perfPipeline = createPerfTracer('pipeline')
export const perfChat = createPerfTracer('chat')
export const perfUpload = createPerfTracer('upload')
