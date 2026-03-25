/**
 * Module worker: batch height samples for terrain (same math as main thread).
 * Instantiate with `new Worker(new URL('./terrain-height-worker.mjs', import.meta.url), { type: 'module' })`.
 * Falls back to main-thread loops when workers are unavailable or bundling omits this file.
 */
import { terrainHeightAtPlaneXY } from './terrain.js'

self.onmessage = (e) => {
	const { id, start, end, xs, ys } = e.data
	const n = end - start
	const out = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		out[i] = terrainHeightAtPlaneXY(xs[i], ys[i])
	}
	self.postMessage({ id, start, out }, [out.buffer])
}
