function hash2(ix, iy) {
	const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123
	return n - Math.floor(n)
}

export function noise2(x, y) {
	const x0 = Math.floor(x)
	const y0 = Math.floor(y)
	const fx = x - x0
	const fy = y - y0
	const u = fx * fx * (3 - 2 * fx)
	const v = fy * fy * (3 - 2 * fy)
	const a = hash2(x0, y0)
	const b = hash2(x0 + 1, y0)
	const c = hash2(x0, y0 + 1)
	const d = hash2(x0 + 1, y0 + 1)
	const i1 = a + (b - a) * u
	const i2 = c + (d - c) * u
	return i1 + (i2 - i1) * v
}

export function fbm2(x, y) {
	let sum = 0
	let amp = 0.55
	let freq = 0.012
	let norm = 0
	for (let o = 0; o < 6; o++) {
		sum += amp * (noise2(x * freq, y * freq) - 0.5) * 2
		norm += amp
		amp *= 0.48
		freq *= 2.05
	}
	return sum / Math.max(norm, 1e-6)
}

/** Ridged multifractal — sharp crests (higher octaves = finer breakup). */
export function ridgedFbm2(x, y) {
	let sum = 0
	let amp = 0.55
	let freq = 0.014
	let norm = 0
	for (let o = 0; o < 6; o++) {
		const n = noise2(x * freq, y * freq)
		const ridge = 1 - Math.abs(n * 2 - 1)
		const r = ridge * ridge
		sum += amp * r
		norm += amp
		amp *= 0.5
		freq *= 2.1
	}
	return sum / Math.max(norm, 1e-6)
}
