/** Default debounce ms by event name. Schema-driven $debounce overrides. */
const FORM_INPUT_EVENTS = ['FORM_SUBMIT', 'UPDATE_INPUT', 'UPDATE_AGENT_INPUT', 'UPDATE_WASM_CODE']

export function getDefaultDebounceMs(eventName, isContentEditable) {
	if (eventName === 'FORM_SUBMIT') return 100
	if (['UPDATE_INPUT_A', 'UPDATE_INPUT_B'].includes(eventName)) return 0
	if (isContentEditable) return 250
	if (FORM_INPUT_EVENTS.includes(eventName)) return 400
	return 0
}

/** Throttle: block rapid re-fires. Returns true if should skip (throttled). */
export function shouldThrottle(eventDebounce, key, debounceMs) {
	if (typeof debounceMs !== 'number' || debounceMs <= 0) return false
	const now = Date.now()
	const last = eventDebounce.get(key)
	if (last != null && now - last < debounceMs) return true
	eventDebounce.set(key, now)
	setTimeout(() => eventDebounce.delete(key), debounceMs)
	return false
}

/** Schedule true debounce: cancel on new call, fire fn with latest when timer elapses. Returns cancel fn. */
export function scheduleDebounceSend(debounceSendTimers, key, debounceMs, fn) {
	const existing = debounceSendTimers.get(key)
	if (existing?.timeoutId) clearTimeout(existing.timeoutId)
	const timeoutId = setTimeout(async () => {
		debounceSendTimers.delete(key)
		await fn()
	}, debounceMs)
	debounceSendTimers.set(key, { timeoutId })
	return () => {
		const entry = debounceSendTimers.get(key)
		if (entry?.timeoutId) clearTimeout(entry.timeoutId)
		debounceSendTimers.delete(key)
	}
}

/** Cancel pending debounce for key. */
export function cancelDebounceSend(debounceSendTimers, key) {
	const existing = debounceSendTimers.get(key)
	if (existing?.timeoutId) clearTimeout(existing.timeoutId)
	debounceSendTimers.delete(key)
}

/** Cooling: block spurious FORM_SUBMIT when overlay just opened. Returns true if should skip. */
export const POPUP_OPEN_COOLING_MS = 350

export function shouldCoolFormSubmit(lastPopupOpenTime, coolingMs = POPUP_OPEN_COOLING_MS) {
	return lastPopupOpenTime > 0 && Date.now() - lastPopupOpenTime < coolingMs
}
