/**
 * TRACE — gated by `LOG_MODE` (`trace.all` / `trace.scope`); in-memory only.
 */

import { isTraceEnabledFromConfig } from './log-config.js'

/** @deprecated Gating uses `LOG_MODE` only; kept for doc / search. */
export const TRACE_STORAGE_KEY = 'maia:debug:trace'

const LOOP_WINDOW_MS = 2000
const LOOP_THRESHOLD = 4

const _recent = []

/**
 * @returns {boolean}
 */
export function isTraceEnabled() {
	return isTraceEnabledFromConfig()
}

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

/**
 * Inbox session filter: multi-client sync — log process vs skip (other session).
 * @param {object} detail
 */
export function traceInboxFilter(detail) {
	if (!isTraceEnabled()) return
	const { decision, messageType, messageCoId, messageSessionId, currentSessionId, actorId, reason } =
		detail
	console.log('[Trace:Inbox:Filter]', {
		decision,
		messageType,
		messageCoId: _short(messageCoId),
		messageSessionId: messageSessionId != null ? _short(String(messageSessionId)) : null,
		currentSessionId: currentSessionId != null ? _short(String(currentSessionId)) : null,
		actorId: actorId != null ? _short(actorId) : null,
		reason: reason ?? '-',
	})
}

/**
 * ProcessEngine op (create/update/delete).
 */
export function traceProcessOp(detail) {
	if (!isTraceEnabled()) return
	const { opKey, factory, hasIdempotencyKey, processId } = detail
	console.log('[Trace:Process:Op]', {
		opKey,
		factory: typeof factory === 'string' ? factory.slice(0, 40) : factory,
		hasIdempotencyKey: hasIdempotencyKey ?? false,
		processId: processId != null ? String(processId).slice(0, 36) : '-',
	})
}

/**
 * DataEngine create: idempotency hit/miss.
 */
export function traceDataCreate(detail) {
	if (!isTraceEnabled()) return
	const { factory, idempotencyKey, deduplicated } = detail
	console.log('[Trace:Data:Create]', {
		factory: typeof factory === 'string' ? factory.slice(0, 40) : factory,
		idempotencyKey: idempotencyKey != null ? _short(String(idempotencyKey)) : null,
		deduplicated: deduplicated ?? false,
	})
}

/**
 * Runtime processInboxForActor.
 */
export function traceRuntimeProcess(detail) {
	if (!isTraceEnabled()) return
	const { inboxCoId, actorId, messageCount, runtimeType } = detail
	console.log('[Trace:Runtime:Process]', {
		inboxCoId: _short(inboxCoId),
		actorId: _short(actorId),
		messageCount,
		runtimeType: runtimeType ?? '-',
	})
}

/**
 * ViewEngine deliverEventFromDOM (after validation).
 */
export function traceViewDeliver(detail) {
	if (!isTraceEnabled()) return
	const { actorId, eventName } = detail
	console.log('[Trace:View:Deliver]', { event: eventName, actor: _short(actorId) })
}

/**
 * ActorEngine processEvents per message.
 */
export function traceActorProcessEvents(detail) {
	if (!isTraceEnabled()) return
	const { actorId, messageType, source, messageCoId, outcome } = detail
	console.log('[Trace:Actor:ProcessEvents]', {
		actor: _short(actorId),
		messageType,
		source: source != null ? _short(source) : null,
		messageCoId: _short(messageCoId),
		outcome,
	})
}
