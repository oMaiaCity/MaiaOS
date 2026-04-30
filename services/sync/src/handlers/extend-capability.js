import { verifyInvocationToken } from '@MaiaOS/maia-ucan'
import { createHash } from 'node:crypto'
import { clientIp } from '../client-ip.js'

/**
 * POST /extend-capability — extend exp by 1 day.
 */
export async function handleExtendCapability(
	{ err, jsonResponse, verifyAccountBinding, loadCoMap, avenMaiaGuardian, opsRegister },
	worker,
	body,
	req,
) {
	const { capabilityId } = body || {}
	if (!capabilityId || typeof capabilityId !== 'string' || !capabilityId.startsWith('co_z'))
		return err('capabilityId required (co_z...)', 400, {}, req)

	const auth = body._authHeader
	const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
	if (!token) return err('Authorization: Bearer token required', 401, {}, req)

	let payload
	try {
		payload = verifyInvocationToken(token, {
			now: Math.floor(Date.now() / 1000),
			allowedCmd: null,
		})
	} catch {
		return err('Invalid or expired token', 401, {}, req)
	}
	const callerAccountId = payload?.accountId
	if (!callerAccountId?.startsWith('co_z')) return err('Invalid token claims', 403, {}, req)

	const bindingOk = await verifyAccountBinding(worker.peer, callerAccountId, payload.iss)
	if (!bindingOk) return err('Account binding verification failed', 403, {}, req)

	try {
		const capContent = await loadCoMap(worker.peer, capabilityId, { retries: 2 })
		const sub = capContent?.get?.('sub')
		const currentExp = capContent?.get?.('exp')
		if (!sub?.startsWith('co_z')) return err('Invalid capability (no sub)', 400, {}, req)

		const isOwner = callerAccountId === sub
		const isGuardian = avenMaiaGuardian?.startsWith('co_z') && callerAccountId === avenMaiaGuardian
		if (!isOwner && !isGuardian)
			return err('Forbidden: only capability owner or guardian can extend', 403, {}, req)

		const now = Math.floor(Date.now() / 1000)
		const oneDay = 86400
		const newExp = Math.max(now, typeof currentExp === 'number' ? currentExp : 0) + oneDay

		const r = await worker.dataEngine.execute({
			op: 'update',
			id: capabilityId,
			data: { exp: newExp },
		})
		if (r?.ok === false)
			return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500, {}, req)
		const ipHash = createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 12)
		opsRegister.log('decision', {
			route: '/extend-capability',
			ok: true,
			status: 200,
			ip_hash: ipHash,
			capabilityId_prefix: capabilityId?.slice(0, 12) ?? null,
		})
		return jsonResponse({ ok: true, newExp }, 200, {}, req)
	} catch (e) {
		return err(e?.message ?? 'failed to extend capability', 500, {}, req)
	}
}
