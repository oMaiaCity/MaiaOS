import { createHash } from 'node:crypto'
import { clientIp } from '../client-ip.js'

/** Default 10 req/min/IP; override per path. OPTIONS exempt. */
export const RL_DEFAULT = 10
export const RL_OVERRIDES = new Map([
	['/health', Number.POSITIVE_INFINITY],
	['/bootstrap', 30],
	['/api/v0/llm/chat', 60],
	['/extend-capability', 20],
	['/register', 30],
])

const RL_BUCKETS = new Map()

export function takeRateLimit(key, limit, windowMs = 60_000) {
	const now = Date.now()
	let b = RL_BUCKETS.get(key)
	if (!b || now - b.start >= windowMs) {
		b = { start: now, count: 1 }
		RL_BUCKETS.set(key, b)
		return { ok: true, reset: now + windowMs }
	}
	if (b.count >= limit) {
		return { ok: false, reset: b.start + windowMs }
	}
	b.count += 1
	return { ok: true, reset: b.start + windowMs }
}

export function rateLimitFor(req, url) {
	if (req.method === 'OPTIONS') return { ok: true, reset: 0 }
	const limit = RL_OVERRIDES.get(url.pathname) ?? RL_DEFAULT
	if (!Number.isFinite(limit) || limit === Number.POSITIVE_INFINITY) {
		return { ok: true, reset: 0 }
	}
	const ip = clientIp(req)
	return takeRateLimit(`${url.pathname}:${ip}`, limit)
}

export function auditRegisterDecision(opsRegister, req, data) {
	const ipHash = createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 12)
	opsRegister.log('decision', { route: '/register', ip_hash: ipHash, ...data })
}
