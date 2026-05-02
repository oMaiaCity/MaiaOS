import { areMigrationsSatisfied, runMigrations } from '@AvenOS/universe/runner'
import { PEER_SYNC_SEED_POLICY } from '../runner.js'

/**
 * @param {string} [id]
 */
export function genesisSeedScaffoldStep(id = 'genesis.seedScaffold') {
	return {
		id,
		policy: PEER_SYNC_SEED_POLICY,
		check: async (ctx) => {
			return await areMigrationsSatisfied(ctx)
		},
		apply: async (ctx) => {
			await runMigrations(ctx)
			ctx.log.info(
				'Genesis migrations complete. Unset PEER_SYNC_SEED after first seed so later restarts are not gated on scaffold.',
			)
		},
	}
}
