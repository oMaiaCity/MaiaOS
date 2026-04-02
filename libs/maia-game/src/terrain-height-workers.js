/**
 * Pool of module workers for parallel terrain height batches (same math as main thread).
 */

/**
 * @param {number} requestedCount
 * @returns {{ workers: Worker[], dispose: () => void }}
 */
/** Bundled worker is served at /game-workers/terrain-height-worker.js (dev + prod). Relative import.meta.url breaks after SPA bundling (404 → HTML). */
function terrainHeightWorkerScriptUrl() {
	if (typeof window !== 'undefined' && window.location?.href) {
		return new URL('/game-workers/terrain-height-worker.js', window.location.href).href
	}
	return new URL('./terrain-height-worker.mjs', import.meta.url).href
}

export function createTerrainHeightWorkerPool(requestedCount) {
	const workers = []
	const n = Math.max(1, Math.min(4, requestedCount | 0))
	const workerUrl = terrainHeightWorkerScriptUrl()
	for (let i = 0; i < n; i++) {
		try {
			workers.push(
				new Worker(workerUrl, {
					type: 'module',
				}),
			)
		} catch {
			break
		}
	}
	if (workers.length === 0) {
		return null
	}
	return {
		workers,
		dispose() {
			for (const w of workers) {
				w.terminate()
			}
		},
	}
}

/**
 * @returns {number}
 */
export function terrainHeightWorkerPoolSize() {
	if (typeof navigator === 'undefined' || !navigator.hardwareConcurrency) {
		return 2
	}
	const hc = navigator.hardwareConcurrency
	return Math.min(4, Math.max(1, Math.floor(hc / 2)))
}
