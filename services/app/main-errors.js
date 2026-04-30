/** Message string from catch — handles non-Error throws (string, Tauri, undefined). */
export function caughtErrMessage(error) {
	if (error == null) return ''
	if (typeof error === 'string') return error
	if (typeof error === 'object' && typeof error.message === 'string') return error.message
	try {
		return String(error)
	} catch {
		return ''
	}
}

export function caughtErrName(error) {
	if (error != null && typeof error === 'object' && typeof error.name === 'string') {
		return error.name
	}
	return ''
}

/** Wait until after the next composited frame (double rAF) so PERF includes visible paint. */
export function waitUntilNextPaint() {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve())
		})
	})
}
