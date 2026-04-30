/**
 * CORS helpers for sync HTTP + WebSocket upgrade.
 * @param {import('@MaiaOS/logs').OpsLogger} opsSync
 * @param {{ configuredCorsOrigin: string; isLocalDevCors: boolean }} cfg
 */

export const DEV_APP_ORIGINS = new Set([
	'http://localhost:4200',
	'http://127.0.0.1:4200',
	'http://[::1]:4200',
])

export function normalizeCorsOrigin(host, isProduction) {
	const trimmed = host?.trim() ?? ''
	if (!trimmed) return ''
	if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
		return isProduction ? `https://${trimmed}` : `http://${trimmed}`
	}
	return trimmed
}

/**
 * @param {import('@MaiaOS/logs').OpsLogger} opsSync
 * @param {{ configuredCorsOrigin: string; isLocalDevCors: boolean }} cfg
 * @returns {(req: Request) => Record<string, string>}
 */
export function corsHeadersForRequestFactory(opsSync, cfg) {
	const { configuredCorsOrigin, isLocalDevCors } = cfg

	return function corsHeadersForRequest(req) {
		const base = {
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		}
		const origin = req?.headers?.get?.('Origin') ?? null

		if (!configuredCorsOrigin) {
			if (!isLocalDevCors) {
				if (origin && DEV_APP_ORIGINS.has(origin)) {
					return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
				}
				if (!origin) {
					return { ...base, 'Access-Control-Allow-Origin': 'http://localhost:4200', Vary: 'Origin' }
				}
				opsSync.warn('CORS: origin not allowed (set PEER_APP_HOST or MAIA_DEV_CORS=1)', origin)
				return { ...base, Vary: 'Origin' }
			}
			if (origin && DEV_APP_ORIGINS.has(origin)) {
				return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
			}
			if (!origin) {
				return { ...base, 'Access-Control-Allow-Origin': 'http://localhost:4200', Vary: 'Origin' }
			}
			opsSync.warn('CORS: origin not allowed (dev, no PEER_APP_HOST)', origin)
			return { ...base, Vary: 'Origin' }
		}

		if (isLocalDevCors) {
			if (origin && (DEV_APP_ORIGINS.has(origin) || origin === configuredCorsOrigin)) {
				return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
			}
			if (!origin) {
				return { ...base, 'Access-Control-Allow-Origin': configuredCorsOrigin, Vary: 'Origin' }
			}
			opsSync.warn('CORS: origin not allowed (dev)', origin)
			return { ...base, Vary: 'Origin' }
		}
		if (!origin) {
			return { ...base, 'Access-Control-Allow-Origin': configuredCorsOrigin, Vary: 'Origin' }
		}
		if (origin === configuredCorsOrigin) {
			return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
		}
		opsSync.warn('CORS: origin not allowed', origin)
		return { ...base, Vary: 'Origin' }
	}
}
