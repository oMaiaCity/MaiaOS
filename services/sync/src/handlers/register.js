import { ensureIdentity, findFirst, generateRegistryName } from '@MaiaOS/aven-os/server'
import { auditRegisterDecision } from '../http/rate-limit.js'

/**
 * POST /register — server self-registration only.
 */
export async function handleRegister(
	{ err, jsonResponse, getSparksRegistryCoId, opsRegister },
	worker,
	body,
	req,
) {
	const { type, username, accountId, profileId, sparkCoId } = body || {}
	if (type !== 'spark' && type !== 'aven')
		return err(
			'type required: spark or aven',
			400,
			{ validationErrors: [{ field: 'type', message: 'must be spark or aven' }] },
			req,
		)
	if (type === 'aven' && (!accountId || typeof accountId !== 'string'))
		return err(
			'accountId required for type=aven',
			400,
			{ validationErrors: [{ field: 'accountId', message: 'required' }] },
			req,
		)
	if (
		type === 'aven' &&
		(!profileId || typeof profileId !== 'string' || !profileId.startsWith('co_z'))
	)
		return err(
			'profileId required for type=aven',
			400,
			{ validationErrors: [{ field: 'profileId', message: 'required (co_z...)' }] },
			req,
		)
	if (type === 'spark' && (!sparkCoId || typeof sparkCoId !== 'string'))
		return err(
			'sparkCoId required for type=spark',
			400,
			{ validationErrors: [{ field: 'sparkCoId', message: 'required' }] },
			req,
		)

	const coId = type === 'spark' ? sparkCoId : accountId
	let u =
		username != null && typeof username === 'string' && username.trim() ? username.trim() : null

	const { peer, dataEngine } = worker
	try {
		if (type === 'aven') {
			await dataEngine.resolveSystemFactories()
			const identitySchemaCoId = peer.infra?.identity
			if (!identitySchemaCoId)
				return err(
					'Identity schema not found. Ensure sync ran genesis (PEER_SYNC_SEED=true once).',
					500,
					{},
					req,
				)
			const existingRow = await findFirst(peer, identitySchemaCoId, {
				account: accountId,
				type,
			})
			if (existingRow?.id?.startsWith('co_z')) {
				return jsonResponse(
					{
						ok: true,
						type,
						username: u ?? generateRegistryName(type),
						accountId: coId,
						identityCoMapId: existingRow.id,
						alreadyRegistered: true,
					},
					200,
					{},
					req,
				)
			}
			if (!u) u = generateRegistryName(type)
			const result = await ensureIdentity({ peer, dataEngine, type, accountId, profileId })
			return jsonResponse(
				{ ok: true, type, username: u, accountId: coId, identityCoMapId: result.identityCoMapId },
				200,
				{},
				req,
			)
		}

		const registryId = getSparksRegistryCoId(worker.account)
		const raw = await peer.getRawRecord(registryId)

		if (!u) u = generateRegistryName(type)
		if (raw?.[u] != null && raw[u] !== coId)
			return err(`username "${u}" already registered to different identity`, 409, {}, req)
		const r = await dataEngine.execute({ op: 'update', id: registryId, data: { [u]: coId } })
		if (r?.ok === false)
			return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500, {}, req)
		return jsonResponse({ ok: true, type, username: u, sparkCoId: coId }, 200, {}, req)
	} catch (e) {
		auditRegisterDecision(opsRegister, req, {
			ok: false,
			status: 500,
			error: e?.message ?? 'failed to register',
		})
		return err(e?.message ?? 'failed to register', 500, {}, req)
	}
}
