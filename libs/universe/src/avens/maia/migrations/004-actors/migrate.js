/**
 * Seeds service/UI actor tables (interfaces, views, contexts, …) without vibe manifests.
 */

import { loadNanoidIndex } from '@MaiaOS/db/cojson/indexing/factory-index-manager'
import { maiaIdentity } from '../../helpers/identity-from-maia-path.js'
import { getSeedConfig } from '../../helpers/seed/build-seed-config.js'
import { seed } from '../../helpers/seed/seed.js'

const SENTINEL_PATH = 'services/db/actor.json'

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function check(ctx) {
	const { worker } = ctx
	const n = maiaIdentity(SENTINEL_PATH).$nanoid
	const idx = await loadNanoidIndex(worker.peer)
	if (!idx?.get) return false
	const id = idx.get(n)
	return typeof id === 'string' && id.startsWith('co_z')
}

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function apply(ctx) {
	const { ensureFactoriesLoaded, getAllFactories } = await import(
		'@MaiaOS/validation/factory-registry'
	)
	const { worker } = ctx

	await ensureFactoriesLoaded()
	const gc = getSeedConfig()
	await seed(
		worker.account,
		worker.node,
		{
			actors: gc.actors,
			processes: gc.processes,
			interfaces: gc.interfaces,
			inboxes: gc.inboxes,
			contexts: gc.contexts,
			views: gc.views,
			styles: gc.styles,
			wasms: gc.wasms,
		},
		getAllFactories(),
		null,
		worker.peer,
		{ forceFreshSeed: true, seedStages: ['instances'] },
	)
}
