/**
 * Persist factory schema rows under the meta-factory only (sparks infra wiring is migration `003-sparks`).
 */

import { loadNanoidIndex } from '@MaiaOS/db/cojson/indexing/factory-index-manager'
import { maiaIdentity } from '../../helpers/identity-from-maia-path.js'
import { seed } from '../../helpers/seed/seed.js'

const META_SENTINEL = 'meta.factory.json'

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function check(ctx) {
	const idx = await loadNanoidIndex(ctx.worker.peer)
	if (!idx?.get) return false
	const metaNn = maiaIdentity(META_SENTINEL).$nanoid
	const metaCoId = idx.get(metaNn)
	if (!(typeof metaCoId === 'string' && metaCoId.startsWith('co_z'))) return false

	const { ensureFactoriesLoaded, getAllFactories } = await import(
		'@MaiaOS/validation/factory-registry'
	)
	await ensureFactoriesLoaded()
	const schemas = getAllFactories()
	for (const schema of Object.values(schemas)) {
		if (!schema || typeof schema !== 'object') continue
		const nn = typeof schema.$nanoid === 'string' && schema.$nanoid.length > 0 ? schema.$nanoid : null
		if (!nn) continue
		const rowCoId = idx.get(nn)
		if (!(typeof rowCoId === 'string' && rowCoId.startsWith('co_z'))) return false
	}
	return true
}

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function apply(ctx) {
	const { ensureFactoriesLoaded, getAllFactories } = await import(
		'@MaiaOS/validation/factory-registry'
	)
	const { worker } = ctx
	await ensureFactoriesLoaded()
	await seed(worker.account, worker.node, null, getAllFactories(), null, worker.peer, {
		forceFreshSeed: true,
		seedStages: ['factoryRows'],
	})
}
