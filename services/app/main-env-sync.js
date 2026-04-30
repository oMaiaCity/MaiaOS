import { getSyncHttpBaseUrl } from '@MaiaOS/runtime'

export const isLocalAppHost =
	typeof window !== 'undefined' &&
	(window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1' ||
		window.location.hostname === '[::1]')

export const isDevEnvironment = import.meta.env?.DEV || isLocalAppHost

/**
 * Sync domain for loader (null in local dev — URLs come from sync-urls + Vite).
 * @returns {string|null}
 */
export function getSyncDomain() {
	if (isDevEnvironment) return null
	return import.meta.env?.VITE_PEER_SYNC_HOST || null
}

/**
 * Secret-key dev env (`VITE_AVEN_*`): **prefer** `window.__MAIA_DEV_ENV__` over `import.meta.env`.
 */
export function getSecretKeyDevEnv() {
	const devEnv = (typeof window !== 'undefined' ? window.__MAIA_DEV_ENV__ : null) ?? null
	const buildEnv = (typeof import.meta !== 'undefined' ? import.meta.env : null) ?? null
	const pick = (key) => {
		const v = devEnv?.[key]
		if (typeof v === 'string' && v !== '') return v
		const b = buildEnv?.[key]
		if (typeof b === 'string' && b !== '') return b
		return ''
	}
	return {
		VITE_AVEN_TEST_MODE: pick('VITE_AVEN_TEST_MODE'),
		VITE_AVEN_TEST_ACCOUNT: pick('VITE_AVEN_TEST_ACCOUNT'),
		VITE_AVEN_TEST_SECRET: pick('VITE_AVEN_TEST_SECRET'),
		VITE_AVEN_TEST_NAME: pick('VITE_AVEN_TEST_NAME'),
		DEV: devEnv?.DEV === true || buildEnv?.DEV === true,
	}
}

/**
 * `VITE_AVEN_TEST_MODE`: secret key dev sign-in in the browser (no WebAuthn).
 */
export function isSecretKeyDevSignInEnabled() {
	const env = getSecretKeyDevEnv()
	if (env.VITE_AVEN_TEST_MODE !== 'true') return false
	const isLocal =
		env.DEV ||
		(typeof window !== 'undefined' &&
			(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
	return isLocal
}

/** Base URL for sync HTTP API (signup, register, extend-capability). */
export function getSyncBaseUrl() {
	return getSyncHttpBaseUrl({
		dev: isDevEnvironment,
		syncDomain: getSyncDomain(),
		vitePeerSyncHost: import.meta.env?.VITE_PEER_SYNC_HOST,
		windowLocation: typeof window !== 'undefined' ? window.location : null,
	})
}

export async function readProfileIdForAccount(maia, accountCoId) {
	try {
		const accountStore = await maia.do({ op: 'read', factory: '@account', key: accountCoId })
		const v = accountStore?.value ?? accountStore
		const p = v?.profile
		return p?.startsWith?.('co_z') ? p : null
	} catch {
		return null
	}
}
