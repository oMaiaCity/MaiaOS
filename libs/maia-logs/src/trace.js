/**
 * TRACE — gated by `LOG_MODE` (`trace.all` / `trace.scope`); in-memory only.
 */

import { emitLog } from './core.js'
import { isTraceEnabledFromConfig } from './log-config.js'

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
		emitLog(
			'warn',
			'',
			['[Trace] possible message loop', { type, from: _short(from), to: _short(to), count }],
			{ applyLevelGate: false },
		)
	}
}

export function traceView(eventName, actorId) {
	if (!isTraceEnabled()) return
	emitLog('log', '', ['[Trace:View]', { event: eventName, actor: _short(actorId) }], {
		applyLevelGate: false,
	})
}

export function traceInbox(senderId, targetId, type) {
	if (!isTraceEnabled()) return
	_detectLoop(senderId, targetId, type)
	emitLog('log', '', ['[Trace:Inbox]', { type, from: _short(senderId), to: _short(targetId) }], {
		applyLevelGate: false,
	})
}

export function traceProcess(processId, event, source, guardPassed) {
	if (!isTraceEnabled()) return
	const actorId = processId?.replace(/_process$/, '')
	emitLog(
		'log',
		'',
		[
			'[Trace:Process]',
			{
				event,
				actor: _short(actorId),
				source: _short(source),
				guardPassed: guardPassed ?? '-',
			},
		],
		{ applyLevelGate: false },
	)
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
		emitLog('log', '', ['[Trace:Context] ERROR state', { actor: _short(actorId), ...snapshot }], {
			applyLevelGate: false,
		})
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
	emitLog(
		'log',
		'',
		[
			'[Trace:Inbox:Filter]',
			{
				decision,
				messageType,
				messageCoId: _short(messageCoId),
				messageSessionId: messageSessionId != null ? _short(String(messageSessionId)) : null,
				currentSessionId: currentSessionId != null ? _short(String(currentSessionId)) : null,
				actorId: actorId != null ? _short(actorId) : null,
				reason: reason ?? '-',
			},
		],
		{ applyLevelGate: false },
	)
}

/**
 * ProcessEngine op (create/update/delete).
 */
export function traceProcessOp(detail) {
	if (!isTraceEnabled()) return
	const { opKey, factory, hasIdempotencyKey, processId } = detail
	emitLog(
		'log',
		'',
		[
			'[Trace:Process:Op]',
			{
				opKey,
				factory: typeof factory === 'string' ? factory.slice(0, 40) : factory,
				hasIdempotencyKey: hasIdempotencyKey ?? false,
				processId: processId != null ? String(processId).slice(0, 36) : '-',
			},
		],
		{ applyLevelGate: false },
	)
}

/**
 * DataEngine create: idempotency hit/miss.
 */
export function traceDataCreate(detail) {
	if (!isTraceEnabled()) return
	const { factory, idempotencyKey, deduplicated } = detail
	emitLog(
		'log',
		'',
		[
			'[Trace:Data:Create]',
			{
				factory: typeof factory === 'string' ? factory.slice(0, 40) : factory,
				idempotencyKey: idempotencyKey != null ? _short(String(idempotencyKey)) : null,
				deduplicated: deduplicated ?? false,
			},
		],
		{ applyLevelGate: false },
	)
}

/**
 * Runtime processInboxForActor.
 */
export function traceRuntimeProcess(detail) {
	if (!isTraceEnabled()) return
	const { inboxCoId, actorId, messageCount, runtimeType } = detail
	emitLog(
		'log',
		'',
		[
			'[Trace:Runtime:Process]',
			{
				inboxCoId: _short(inboxCoId),
				actorId: _short(actorId),
				messageCount,
				runtimeType: runtimeType ?? '-',
			},
		],
		{ applyLevelGate: false },
	)
}

/**
 * ViewEngine deliverEventFromDOM (after validation).
 */
export function traceViewDeliver(detail) {
	if (!isTraceEnabled()) return
	const { actorId, eventName } = detail
	emitLog('log', '', ['[Trace:View:Deliver]', { event: eventName, actor: _short(actorId) }], {
		applyLevelGate: false,
	})
}

/**
 * ActorEngine processEvents per message.
 */
export function traceActorProcessEvents(detail) {
	if (!isTraceEnabled()) return
	const { actorId, messageType, source, messageCoId, outcome } = detail
	emitLog(
		'log',
		'',
		[
			'[Trace:Actor:ProcessEvents]',
			{
				actor: _short(actorId),
				messageType,
				source: source != null ? _short(source) : null,
				messageCoId: _short(messageCoId),
				outcome,
			},
		],
		{ applyLevelGate: false },
	)
}
