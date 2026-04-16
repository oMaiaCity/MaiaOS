/** @typedef {{ write: (level: string, subsystem: string, parts: unknown[]) => void }} MaiaLogTransport */

/**
 * @returns {MaiaLogTransport}
 */
export function createNoopTransport() {
	return {
		write() {},
	}
}
