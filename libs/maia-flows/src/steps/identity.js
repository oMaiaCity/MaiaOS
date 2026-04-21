import { ensureIdentity, findFirst } from '@MaiaOS/db'

export function identitySelfAvenStep(id = 'identity.selfAven') {
	return {
		id,
		check: async (ctx) => {
			const accountId = ctx.env.serverAccountId
			const profileId = ctx.worker.account.get('profile')
			if (!accountId?.startsWith('co_z') || !profileId?.startsWith('co_z')) return true
			await ctx.worker.dataEngine.resolveSystemFactories()
			const identitySchemaCoId = ctx.worker.peer.infra?.identity
			if (!identitySchemaCoId?.startsWith('co_z')) return true
			const existingRow = await findFirst(ctx.worker.peer, identitySchemaCoId, {
				account: accountId,
				type: 'aven',
			})
			return existingRow?.id?.startsWith('co_z') === true
		},
		apply: async (ctx) => {
			const accountId = ctx.env.serverAccountId
			const profileId = ctx.worker.account.get('profile')
			if (!accountId?.startsWith('co_z') || !profileId?.startsWith('co_z')) return
			await ctx.worker.dataEngine.resolveSystemFactories()
			const identitySchemaCoId = ctx.worker.peer.infra?.identity
			if (!identitySchemaCoId?.startsWith('co_z')) {
				ctx.log.warn('identity.selfAven: OS_IDENTITY not ready')
				return
			}
			await ensureIdentity({
				peer: ctx.worker.peer,
				dataEngine: ctx.worker.dataEngine,
				type: 'aven',
				accountId,
				profileId,
			})
		},
	}
}

/**
 * Human row for POST /bootstrap (per-request accountId / profileId on ctx.bootstrap).
 */
export function identityHumanBootstrapStep(id = 'identity.human') {
	return {
		id,
		check: async (ctx) => {
			const accountId = ctx.bootstrap?.accountId
			const profileId = ctx.bootstrap?.profileId
			if (!accountId?.startsWith('co_z') || !profileId?.startsWith('co_z')) return true
			await ctx.worker.dataEngine.resolveSystemFactories()
			const identitySchemaCoId = ctx.worker.peer.infra?.identity
			if (!identitySchemaCoId?.startsWith('co_z')) return true
			const existing = await findFirst(ctx.worker.peer, identitySchemaCoId, {
				account: accountId,
				type: 'human',
			})
			return existing?.id?.startsWith('co_z') === true
		},
		apply: async (ctx) => {
			const accountId = ctx.bootstrap?.accountId
			const profileId = ctx.bootstrap?.profileId
			if (!accountId?.startsWith('co_z') || !profileId?.startsWith('co_z')) return
			await ctx.worker.dataEngine.resolveSystemFactories()
			const identitySchemaCoId = ctx.worker.peer.infra?.identity
			if (!identitySchemaCoId?.startsWith('co_z')) {
				ctx.log.warn('identity.human: OS_IDENTITY factory not ready')
				return
			}
			await ensureIdentity({
				peer: ctx.worker.peer,
				dataEngine: ctx.worker.dataEngine,
				type: 'human',
				accountId,
				profileId,
			})
		},
	}
}
