import { accountHasCapabilityOnPeer } from '@MaiaOS/db'

const CAP_EXP = () => Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600

/**
 * @param {import('../context.js').FlowContext} ctx
 * @param {{ sub: string, cmd: string }} p
 */
export async function ensureCapabilityGrant(ctx, { sub, cmd }) {
	const { worker, log } = ctx
	const { peer, dataEngine } = worker
	if (!peer.infra?.capability) {
		await dataEngine.resolveSystemFactories()
	}
	if (await accountHasCapabilityOnPeer(peer, worker.account, sub, cmd)) return
	const capabilitySchemaCoId = peer.infra?.capability
	if (!capabilitySchemaCoId) {
		log.warn('ensureCapabilityGrant: OS_CAPABILITY factory missing after resolveSystemFactories', {
			sub: sub?.slice(0, 14),
			cmd,
		})
		return
	}
	try {
		await dataEngine.execute({
			op: 'create',
			factory: capabilitySchemaCoId,
			data: { sub, cmd, pol: [], exp: CAP_EXP() },
			spark: peer.systemSparkCoId,
		})
	} catch (e) {
		log.warn('Failed to create capability grant', e?.message ?? e)
	}
}

/**
 * @param {string} cmd
 */
export function capabilityGrantStep(id, subGetter, cmd) {
	return {
		id,
		check: async (ctx) => {
			const sub = subGetter(ctx)
			if (!sub?.startsWith('co_z')) return true
			const { peer, account } = ctx.worker
			return accountHasCapabilityOnPeer(peer, account, sub, cmd)
		},
		apply: async (ctx) => {
			const sub = subGetter(ctx)
			if (!sub?.startsWith('co_z')) return
			await ensureCapabilityGrant(ctx, { sub, cmd })
		},
	}
}

export function serverAdminStep(id = 'caps.serverAdmin') {
	return {
		id,
		check: async (ctx) => {
			const sid = ctx.env.serverAccountId
			if (!sid?.startsWith('co_z')) return true
			const { peer, account } = ctx.worker
			return accountHasCapabilityOnPeer(peer, account, sid, '/admin')
		},
		apply: async (ctx) => {
			const sid = ctx.env.serverAccountId
			if (!sid?.startsWith('co_z')) return
			await ensureCapabilityGrant(ctx, { sub: sid, cmd: '/admin' })
		},
	}
}
