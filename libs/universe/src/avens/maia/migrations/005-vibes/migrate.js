/**
 * Seeds per-vibe instances (from buildSeedConfig) plus icons/todos/data buckets.
 */

import * as groups from '@MaiaOS/db'
import { ensureCoValueLoaded } from '@MaiaOS/db'
import { buildSeedConfig } from '../../helpers/seed/build-seed-config.js'
import { getAllVibeRegistries } from '../../helpers/seed/registry-merge.js'
import { seed } from '../../helpers/seed/seed.js'
import { filterVibesForSeeding } from '../../helpers/seed/vibe-seed-helpers.js'

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function check(ctx) {
	const { worker } = ctx
	const MAIA = '°maia'
	const osId = await groups.getSparkOsId(worker.peer, MAIA)
	if (!osId?.startsWith?.('co_z')) return false

	const osCore = await ensureCoValueLoaded(worker.peer, osId, { waitForAvailable: true })
	if (!osCore || !worker.peer.isAvailable?.(osCore)) return false

	const os = worker.peer.getCurrentContent(osCore)
	const vibesCoId = os?.get?.('vibes')
	if (typeof vibesCoId !== 'string' || !vibesCoId.startsWith('co_z')) return false

	const vCore = await ensureCoValueLoaded(worker.peer, vibesCoId, { waitForAvailable: true })
	if (!vCore || !worker.peer.isAvailable?.(vCore)) return false

	const cmap = worker.peer.getCurrentContent(vCore)
	if (!cmap || typeof cmap.keys !== 'function') return false

	const ks = cmap.keys?.() ?? Object.keys(cmap)
	const count = [...ks].length
	return count > 0
}

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function apply(ctx) {
	const { ensureFactoriesLoaded, getAllFactories } = await import(
		'@MaiaOS/validation/factory-registry'
	)
	const { worker } = ctx

	await ensureFactoriesLoaded()
	const regs = filterVibesForSeeding(await getAllVibeRegistries(), 'all')
	if (regs.length === 0) {
		throw new Error('[migrate 005-vibes] no vibe registries loaded')
	}
	const { configs, data } = buildSeedConfig(regs)
	await seed(worker.account, worker.node, configs, getAllFactories(), data, worker.peer, {
		forceFreshSeed: true,
		seedStages: ['instances'],
	})
}
