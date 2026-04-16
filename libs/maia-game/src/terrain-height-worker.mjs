/**
 * Module worker: batch height samples for terrain (same math as main thread).
 * Production/dev load the bundled script at `/game-workers/terrain-height-worker.js` (see terrain-height-workers.js).
 */
import { createLogger } from '@MaiaOS/logs'
import { terrainHeightAtPlaneXY } from './terrain.js'

const log = createLogger('terrain-worker')

self.onmessage = (e) => {
	const { id, start, end, xs, ys } = e.data
	const n = end - start
	const out = new Float32Array(n)
	try {
		for (let i = 0; i < n; i++) {
			out[i] = terrainHeightAtPlaneXY(xs[i], ys[i])
		}
	} catch (err) {
		log.error('[terrain-height-worker]', err)
		out.fill(0)
	}
	self.postMessage({ id, start, out }, [out.buffer])
}
