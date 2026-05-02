/**
 * Sparks migrate-step infra checks (migration `003-sparks`; persisted spark.os cmap unchanged).
 */

import * as groups from '@MaiaOS/db'
import { ensureCoValueLoaded, INFRA_SLOTS } from '@MaiaOS/db'

const MAIA_SPARK = '°maia'

/** @param {object} peer — MaiaDB peer */
export async function isSparksInfraComplete(peer) {
	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId?.startsWith?.('co_z')) return false
	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
	if (!osCore || !peer.isAvailable?.(osCore)) return false
	const os = peer.getCurrentContent(osCore)
	if (!os || typeof os.get !== 'function') return false
	for (const { slotKey } of INFRA_SLOTS) {
		const v = os.get(slotKey)
		if (typeof v !== 'string' || !v.startsWith('co_z')) {
			return false
		}
	}
	return true
}
