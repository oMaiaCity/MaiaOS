import {
	STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE,
	STORAGE_INSPECTOR_MAX_TABLE_PAGE,
	verifyInvocationToken,
} from '@MaiaOS/aven-os/server'

export const STORAGE_INSPECTOR_BASE = '/api/v0/admin/storage'

/**
 * @param {object} args
 * @param {typeof jsonResponse} args.jsonResponse
 * @param {() => object | null} args.getStorageInspector
 */
export function createHandleStorageInspectorHttp({
	jsonResponse,
	getStorageInspector,
	verifyAccountBinding,
	hasValidCapability,
}) {
	/**
	 * @param {Request} req
	 * @param {URL} url
	 * @param {object | null} worker
	 */
	return async function handleStorageInspectorHttp(req, url, worker) {
		if (!worker) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
		const storageInspector = getStorageInspector()
		if (!storageInspector) {
			return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
		}

		const auth = req.headers.get('Authorization')
		const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
		if (!token) {
			return jsonResponse({ error: 'Unauthorized', message: 'Bearer token required' }, 401, {}, req)
		}
		let payload
		try {
			payload = verifyInvocationToken(token, {
				now: Math.floor(Date.now() / 1000),
				allowedCmd: '/admin/storage',
			})
		} catch {
			return jsonResponse({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401, {}, req)
		}
		const accountId = payload?.accountId
		if (!accountId?.startsWith('co_z')) {
			return jsonResponse({ error: 'Forbidden', message: 'Invalid token claims' }, 403, {}, req)
		}
		const bindingOk = await verifyAccountBinding(worker.peer, accountId, payload.iss)
		if (!bindingOk) {
			return jsonResponse(
				{ error: 'Forbidden', message: 'Account binding verification failed' },
				403,
				{},
				req,
			)
		}
		const hasCap = await hasValidCapability(worker, accountId, '/admin/storage')
		if (!hasCap) {
			return jsonResponse(
				{
					error: 'Forbidden',
					message:
						'No valid /admin/storage capability. Ask a guardian to grant you access in Capabilities.',
				},
				403,
				{},
				req,
			)
		}

		const pathname = url.pathname

		if (pathname === `${STORAGE_INSPECTOR_BASE}/tables` && req.method === 'GET') {
			let limit = Number(url.searchParams.get('limit'))
			let offset = Number(url.searchParams.get('offset'))
			if (Number.isNaN(limit) || limit < 1) limit = STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE
			if (limit > STORAGE_INSPECTOR_MAX_TABLE_PAGE) limit = STORAGE_INSPECTOR_MAX_TABLE_PAGE
			if (Number.isNaN(offset) || offset < 0) offset = 0
			const res = await storageInspector.listTables({ limit, offset })
			return jsonResponse({ ok: true, ...res }, 200, {}, req)
		}

		const prefix = `${STORAGE_INSPECTOR_BASE}/tables/`
		const suffix = '/columns'
		if (pathname.startsWith(prefix) && pathname.endsWith(suffix) && req.method === 'GET') {
			const enc = pathname.slice(prefix.length, -suffix.length)
			const name = decodeURIComponent(enc)
			try {
				const res = await storageInspector.describeTable(name)
				return jsonResponse({ ok: true, ...res }, 200, {}, req)
			} catch (e) {
				return jsonResponse({ ok: false, error: e?.message || String(e) }, 400, {}, req)
			}
		}

		if (pathname === `${STORAGE_INSPECTOR_BASE}/query` && req.method === 'POST') {
			let body
			try {
				body = await req.json()
			} catch {
				return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, {}, req)
			}
			const sql = body?.sql
			const params = body?.params
			if (typeof sql !== 'string') {
				return jsonResponse({ ok: false, error: 'sql string required' }, 400, {}, req)
			}
			try {
				const res = await storageInspector.query(sql, Array.isArray(params) ? params : [])
				return jsonResponse({ ok: true, ...res }, 200, {}, req)
			} catch (e) {
				return jsonResponse({ ok: false, error: e?.message || String(e) }, 400, {}, req)
			}
		}

		return null
	}
}
