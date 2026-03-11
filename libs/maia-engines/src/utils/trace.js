/**
 * Diagnostic trace for actors, events, and context.
 * Enable via localStorage: maia:debug:trace = '1'
 * Or URL: ?maia_trace=1
 *
 * Logs: phase, actorId, event, source, target, context snapshot (on ERROR)
 * Detects: message loops (same type bouncing between same two actors)
 */

const TRACE_KEY = 'maia:debug:trace'
const LOOP_WINDOW_MS = 2000
const LOOP_THRESHOLD = 4 // same type between same pair → warn

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

/** Recent deliveries: { from, to, type, ts }[] */
const _recent = []

function _short(id) {
	return id ? `${id.slice(0, 12)}...` : '-'
}

function _detectLoop(from, to, type) {
	const now = Date.now()
	_recent.push({ from, to, type, ts: now })
	// Keep only recent
	while (_recent.length > 20) _recent.shift()
	// Count same type between this pair in window
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
	console.log('[Trace:Inbox]', {
		type,
		from: _short(senderId),
		to: _short(targetId),
	})
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
	} catch {
		// ignore
	}
}
