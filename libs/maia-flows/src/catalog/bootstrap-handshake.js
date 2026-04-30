import { extractAccountMembers } from '@MaiaOS/db'
import { guardianCapStep, guardianMaiaAdminStep } from '../steps/guardian.js'
import { identityHumanBootstrapStep } from '../steps/identity.js'

/**
 * @param {{ guardianAccountId: string | null, bootstrapAccountId: string }} p
 */
export function bootstrapGuardianSteps({ guardianAccountId, bootstrapAccountId }) {
	if (!(guardianAccountId?.startsWith('co_z') && bootstrapAccountId === guardianAccountId)) return []
	return [
		guardianMaiaAdminStep(),
		guardianCapStep('guardian.caps.syncWrite', '/sync/write'),
		guardianCapStep('guardian.caps.llmChat', '/llm/chat'),
		guardianCapStep('guardian.caps.adminStorage', '/admin/storage'),
	]
}

/**
 * Add every bootstrapping human to °maia guardian as reader (org visibility + delegated reads).
 * Previously only `bootstrapGuardianSteps` ran when bootstrapAccountId matched env guardian; other humans never joined the group.
 */
export function bootstrapHumanMaiaOrgStep(id = 'bootstrap.humanMaiaOrg') {
	return {
		id,
		check: async (ctx) => {
			const accountId = ctx.bootstrap?.accountId
			if (!accountId?.startsWith('co_z')) return true
			const group = await ctx.worker.peer.getMaiaGroup()
			if (!group) return false
			const members = extractAccountMembers(group)
			return members.some((m) => m.id === accountId)
		},
		apply: async (ctx) => {
			const accountId = ctx.bootstrap?.accountId
			if (!accountId?.startsWith('co_z')) return
			const group = await ctx.worker.peer.getMaiaGroup()
			if (!group) {
				ctx.log.warn('bootstrap.humanMaiaOrg: °maia guardian group not ready')
				return
			}
			try {
				await ctx.worker.peer.addGroupMember(group, accountId, 'reader')
			} catch (e) {
				const msg = e?.message ?? String(e)
				if (msg.includes('already') || msg.includes('member')) return
				ctx.log.warn('bootstrap.humanMaiaOrg: %s', msg.slice(0, 120))
			}
		},
	}
}

export function bootstrapIdentitySteps() {
	return [bootstrapHumanMaiaOrgStep(), identityHumanBootstrapStep()]
}
