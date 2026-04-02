/**
 * Sync HTTP base + WebSocket URL — single source for app and setupSyncPeers.
 */

/**
 * @param {Object} opts
 * @param {boolean} opts.dev - Local dev (Vite DEV or browser on loopback)
 * @param {string|null|undefined} opts.syncDomain - Loader override (null in dev app = use Vite / default)
 * @param {string|undefined} opts.vitePeerSyncHost - import.meta.env.VITE_PEER_SYNC_HOST
 * @param {{ hostname: string, protocol?: string, host?: string }|null|undefined} opts.windowLocation - browser location
 * @returns {string|null}
 */
export function getSyncHttpBaseUrl({ dev, syncDomain, vitePeerSyncHost, windowLocation }) {
	const apiDomain = syncDomain ?? vitePeerSyncHost ?? null
	if (!apiDomain && dev && windowLocation?.hostname) {
		return `http://${windowLocation.hostname}:4201`
	}
	if (!apiDomain && dev) return 'http://localhost:4201'
	if (!apiDomain) return null
	const host = String(apiDomain)
		.replace(/^https?:\/\//, '')
		.split('/')[0]
	const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':4201')
	return `${isLocal ? 'http' : 'https'}://${host}`
}

/**
 * @param {Object} opts
 * @param {string|null|undefined} opts.syncDomain
 * @param {string|undefined} opts.vitePeerSyncHost
 * @param {string|undefined} opts.processPeerSyncHost
 * @param {{ hostname: string, protocol?: string, host?: string }|null|undefined} opts.windowLocation
 * @param {boolean} opts.isDev
 * @param {boolean} opts.hasWindow
 * @returns {string|null}
 */
export function getSyncWebSocketUrl({
	syncDomain = null,
	vitePeerSyncHost,
	processPeerSyncHost,
	windowLocation,
	isDev,
	hasWindow,
}) {
	const apiDomain =
		syncDomain ||
		vitePeerSyncHost ||
		(typeof process !== 'undefined' ? processPeerSyncHost : undefined) ||
		null

	if (!hasWindow) {
		if (!syncDomain) return null
		const protocol =
			syncDomain.includes('localhost') || syncDomain.includes('127.0.0.1') ? 'ws:' : 'wss:'
		return `${protocol}//${syncDomain}/sync`
	}

	if (isDev) {
		const defaultHost = windowLocation?.hostname
			? `${windowLocation.hostname}:4201`
			: 'localhost:4201'
		const devSync = apiDomain || defaultHost
		const isLocal = devSync.includes('localhost') || devSync.includes('127.0.0.1')
		return `${isLocal ? 'ws:' : 'wss:'}//${devSync}/sync`
	}

	if (apiDomain) {
		const isLocal = apiDomain.includes('localhost') || apiDomain.includes('127.0.0.1')
		return `${isLocal ? 'ws:' : 'wss:'}//${apiDomain}/sync`
	}

	const protocol = windowLocation?.protocol === 'https:' ? 'wss:' : 'ws:'
	const host = windowLocation?.host ?? 'localhost'
	return `${protocol}//${host}/sync`
}
