/**
 * Structural registry shell — no factory definition rows beyond the self-referential meta factory CoMap.
 */

import * as groups from '@MaiaOS/db'
import { ensureCoValueLoaded } from '@MaiaOS/db'
import {
	ensureNanoidIndexCoMap,
	NANOID_INDEX_KEY,
} from '@MaiaOS/db/cojson/indexing/factory-index-manager'
import { bootstrapAccountSparks, bootstrapAndScaffold } from '../../helpers/seed/bootstrap.js'

const SPARK_OS_META_FACTORY_CO_ID_KEY = 'metaFactoryCoId'
const MAIA = '°maia'

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function check(ctx) {
	const { worker } = ctx
	const { peer, account } = worker

	const sparksTop = account.get?.('sparks')
	if (typeof sparksTop !== 'string' || !sparksTop.startsWith('co_z')) {
		return false
	}

	await bootstrapAccountSparks(peer)

	const osId = await groups.getSparkOsId(peer, MAIA)
	if (!osId?.startsWith?.('co_z')) return false

	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
	if (!osCore || !peer.isAvailable?.(osCore)) return false

	const os = peer.getCurrentContent(osCore)
	if (!os || typeof os.get !== 'function') return false

	const metaCoId = os.get(SPARK_OS_META_FACTORY_CO_ID_KEY)
	if (typeof metaCoId !== 'string' || !metaCoId.startsWith('co_z')) return false

	const indexesId = os.get('indexes')
	if (typeof indexesId !== 'string' || !indexesId.startsWith('co_z')) return false

	const idxCore = await ensureCoValueLoaded(peer, indexesId, { waitForAvailable: true })
	if (!idxCore || !peer.isAvailable?.(idxCore)) return false
	const indexes = peer.getCurrentContent(idxCore)
	if (!indexes || typeof indexes.get !== 'function') return false

	const nanoidsId = indexes.get(NANOID_INDEX_KEY)
	if (typeof nanoidsId !== 'string' || !nanoidsId.startsWith('co_z')) return false

	return true
}

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function apply(ctx) {
	const { worker } = ctx
	const { peer, account, node } = worker

	await bootstrapAndScaffold(account, node, null, peer.dbEngine ?? null)
	await bootstrapAccountSparks(peer)
	await ensureNanoidIndexCoMap(peer)
}
