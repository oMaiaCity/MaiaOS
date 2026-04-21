import { accountHasCapabilityOnPeer, extractAccountMembers } from '@MaiaOS/db'
import { ensureCapabilityGrant } from './capabilities.js'

function guardianRelevant(ctx) {
	const g = ctx.env.guardianAccountId
	const s = ctx.env.serverAccountId
	if (!g?.startsWith('co_z')) return false
	if (g === s) return false
	return true
}

/**
 * @param {string} id
 */
export function guardianMaiaAdminStep(id = 'guardian.adminOnMaiaSpark') {
	return {
		id,
		check: async (ctx) => {
			if (!guardianRelevant(ctx)) return true
			const gid = ctx.env.guardianAccountId
			const group = await ctx.worker.peer.getMaiaGroup()
			if (!group) return false
			const members = extractAccountMembers(group)
			return members.some((m) => m.id === gid && (m.role === 'admin' || m.role === 'manager'))
		},
		apply: async (ctx) => {
			if (!guardianRelevant(ctx)) return
			const gid = ctx.env.guardianAccountId
			try {
				const guardian = await ctx.worker.peer.getMaiaGroup()
				if (!guardian) {
					ctx.log.warn('guardian.adminOnMaiaSpark: °maia group not ready — deferred to POST /bootstrap')
					return
				}
				await ctx.worker.peer.addGroupMember(guardian, gid, 'admin')
			} catch (e) {
				const msg = e?.message ?? String(e)
				if (msg.includes('already') || msg.includes('member')) return
				// Same as pre-flows sync: fire-and-forget promotion; guardian account may not be in local storage yet (ensureCoValueLoaded 10s timeout).
				ctx.log.warn(
					'guardian.adminOnMaiaSpark: deferred to first POST /bootstrap (%s)',
					msg.slice(0, 120),
				)
			}
		},
	}
}

/** @param {string} cmd */
export function guardianCapStep(id, cmd) {
	return {
		id,
		check: async (ctx) => {
			if (!guardianRelevant(ctx)) return true
			const gid = ctx.env.guardianAccountId
			const { peer, account } = ctx.worker
			return accountHasCapabilityOnPeer(peer, account, gid, cmd)
		},
		apply: async (ctx) => {
			if (!guardianRelevant(ctx)) return
			const gid = ctx.env.guardianAccountId
			await ensureCapabilityGrant(ctx, { sub: gid, cmd })
		},
	}
}
