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

export function bootstrapIdentitySteps() {
	return [identityHumanBootstrapStep()]
}
