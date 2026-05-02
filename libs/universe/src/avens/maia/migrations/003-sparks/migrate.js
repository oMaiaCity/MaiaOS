/**
 * Wire sparks (spark.os) INFRA_SLOTS, definition catalog hydration, and indexes after factory rows exist.
 */

import { seed } from '../../helpers/seed/seed.js'
import { isSparksInfraComplete } from '../../helpers/seed/sparks.js'

/** @param {import('../../runner.js').MigrateContext} ctx */
export async function check(ctx) {
	return isSparksInfraComplete(ctx.worker.peer)
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
		seedStages: ['sparks'],
	})
}
