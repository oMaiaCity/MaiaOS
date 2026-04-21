/**
 * One-shot migration: write `spark.os` infra slots from `@nanoids` + optional catalog walk.
 * Run manually (e.g. `bun run scripts/migrate-spark-os-infra.js`); **not** invoked on boot.
 */
import { getSparkOsId, INFRA_SLOTS, loadInfraFromSparkOs } from '@MaiaOS/db'
import { loadNanoidIndex } from '@MaiaOS/db/cojson/indexing/factory-index-manager'
import { maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'

const MAIA_SPARK = '°maia'

/**
 * @param {object} peer - MaiaDB
 * @returns {Promise<{ written: string[] }>}
 */
export async function migrateSparkOsInfraSlots(peer) {
	const osId = await getSparkOsId(peer, MAIA_SPARK)
	if (!osId?.startsWith('co_z')) {
		throw new Error('[migrateSparkOsInfraSlots] spark.os not found')
	}
	const nanoids = await loadNanoidIndex(peer)
	if (!nanoids || typeof nanoids.get !== 'function') {
		throw new Error('[migrateSparkOsInfraSlots] @nanoids index missing')
	}
	const osCore = peer.getCoValue(osId)
	if (!osCore) throw new Error('[migrateSparkOsInfraSlots] os CoValue missing')
	const os = peer.getCurrentContent(osCore)
	if (!os?.set) throw new Error('[migrateSparkOsInfraSlots] os content not a CoMap')

	const written = []
	for (const { slotKey, basename } of INFRA_SLOTS) {
		const n = maiaIdentity(basename).$nanoid
		const coId = nanoids.get(n)
		if (coId?.startsWith('co_z')) {
			os.set(slotKey, coId)
			written.push(slotKey)
		}
	}
	await loadInfraFromSparkOs(peer, osId)
	return { written }
}
