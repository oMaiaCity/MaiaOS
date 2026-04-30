import { handleBootstrap } from './bootstrap.js'
import { handleExtendCapability } from './extend-capability.js'
import { handleRegister } from './register.js'

const REQUEST_TIMEOUT_MS = 35000

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
		),
	])
}

/**
 * Agent HTTP routes: /register, /bootstrap, /extend-capability.
 */
export function createHandleAgentHttp(routeDeps) {
	return async function handleAgentHttp(req, worker) {
		const url = new URL(req.url)
		const post = async (strict, handler) => {
			try {
				const body = strict ? await req.json() : await req.json().catch(() => ({}))
				return await handler(worker, body, req)
			} catch (e) {
				return routeDeps.err(e.message, e?.message?.includes('timed out') ? 504 : 400, {}, req)
			}
		}
		if (url.pathname === '/register' && req.method === 'POST')
			return post(false, (w, b, r) =>
				withTimeout(handleRegister(routeDeps.register, w, b, r), REQUEST_TIMEOUT_MS, '/register'),
			)
		if (url.pathname === '/bootstrap' && req.method === 'POST')
			return post(false, (w, b, r) =>
				withTimeout(handleBootstrap(routeDeps.bootstrap, w, b, r), REQUEST_TIMEOUT_MS, '/bootstrap'),
			)
		if (url.pathname === '/extend-capability' && req.method === 'POST') {
			const auth = req.headers.get('Authorization')
			return post(false, (w, b, r) =>
				withTimeout(
					handleExtendCapability(routeDeps.extend, w, { ...b, _authHeader: auth }, r),
					REQUEST_TIMEOUT_MS,
					'/extend-capability',
				),
			)
		}
		return null
	}
}
