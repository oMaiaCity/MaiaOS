/**
 * Diagnostic trace and performance tracers. Enable via localStorage:
 * - maia:debug:trace = '1' or ?maia_trace=1
 * - maia:perf:pipeline = '1', maia:perf:chat = '1'
 */

const TRACE_KEY = 'maia:debug:trace'
const LOOP_WINDOW_MS = 2000
const LOOP_THRESHOLD = 4

function isTraceEnabled() {
	if (typeof window === 'undefined') return false
	try {
		const fromStorage = localStorage?.getItem(TRACE_KEY) === '1'
		const fromUrl = new URLSearchParams(window.location?.search || '').get('maia_trace') === '1'
		return fromStorage || fromUrl
	} catch {
		return false
	}
}

const _recent = []

function _short(id) {
	return id ? `${id.slice(0, 12)}...` : '-'
}

function _detectLoop(from, to, type) {
	const now = Date.now()
	_recent.push({ from, to, type, ts: now })
	while (_recent.length > 20) _recent.shift()
	const count = _recent.filter(
		(d) =>
			d.type === type &&
			((d.from === from && d.to === to) || (d.from === to && d.to === from)) &&
			now - d.ts < LOOP_WINDOW_MS,
	).length
	if (count >= LOOP_THRESHOLD) {
		console.warn('[Trace] possible message loop', { type, from: _short(from), to: _short(to), count })
	}
}

export function traceView(eventName, actorId) {
	if (!isTraceEnabled()) return
	console.log('[Trace:View]', { event: eventName, actor: _short(actorId) })
}

export function traceInbox(senderId, targetId, type) {
	if (!isTraceEnabled()) return
	_detectLoop(senderId, targetId, type)
	console.log('[Trace:Inbox]', { type, from: _short(senderId), to: _short(targetId) })
}

export function traceProcess(processId, event, source, guardPassed) {
	if (!isTraceEnabled()) return
	const actorId = processId?.replace(/_process$/, '')
	console.log('[Trace:Process]', {
		event,
		actor: _short(actorId),
		source: _short(source),
		guardPassed: guardPassed ?? '-',
	})
}

export function traceContextOnError(actorId, context) {
	if (!isTraceEnabled()) return
	try {
		const val = context?.value
		if (!val) return
		const snapshot = {}
		for (const k of ['phase', 'hasError', 'error', 'inputValue', 'isLoading', 'pendingInputText']) {
			if (k in val) snapshot[k] = val[k]
		}
		console.log('[Trace:Context] ERROR state', { actor: _short(actorId), ...snapshot })
	} catch {}
}

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
