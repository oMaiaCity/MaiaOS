/**
 * Default transport: stderr/stdout style via `console` (only file allowed to call `console.*` from app code — see biome override).
 */

/** @typedef {{ write: (level: string, subsystem: string, parts: unknown[]) => void }} MaiaLogTransport */

/**
 * @param {{ json?: boolean }} opts
 * @returns {MaiaLogTransport}
 */
export function createConsoleTransport(opts = {}) {
	const json = opts.json === true
	return {
		write(level, subsystem, parts) {
			if (json) {
				const line = JSON.stringify({
					ts: new Date().toISOString(),
					level,
					subsystem,
					parts,
				})
				console.log(line)
				return
			}
			const prefix = subsystem ? `[${subsystem}]` : ''
			const out = prefix ? [prefix, ...parts] : parts
			if (level === 'error') {
				console.error(...out)
			} else if (level === 'warn') {
				console.warn(...out)
			} else {
				console.log(...out)
			}
		},
	}
}
