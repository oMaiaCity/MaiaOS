import { serverAdminStep } from '../steps/capabilities.js'
import { genesisSeedScaffoldStep } from '../steps/genesis.js'
import { guardianCapStep, guardianMaiaAdminStep } from '../steps/guardian.js'
import { identitySelfAvenStep } from '../steps/identity.js'
import { resolveSystemFactoriesStep, resolveSystemSparkStep } from '../steps/runtime.js'

/** Infra + caps + guardian (strict); aven identity is best-effort in sync (see below). */
export const syncServerInfraSteps = [
	genesisSeedScaffoldStep(),
	resolveSystemSparkStep(),
	resolveSystemFactoriesStep(),
	serverAdminStep(),
	guardianMaiaAdminStep(),
	guardianCapStep('guardian.caps.syncWrite', '/sync/write'),
	guardianCapStep('guardian.caps.llmChat', '/llm/chat'),
	guardianCapStep('guardian.caps.adminStorage', '/admin/storage'),
]

/** Full ordered list (sync may run the last step inside try/catch). */
export const syncServerStartupSteps = [...syncServerInfraSteps, identitySelfAvenStep()]
