import { buildSeedConfig, filterVibesForSeeding, getSeedConfig } from '@MaiaOS/seed'
import { PEER_SYNC_SEED_POLICY } from '../runner.js'

/**
 * @param {string} [id]
 */
export function genesisSeedScaffoldStep(id = 'genesis.seedScaffold') {
	return {
		id,
		policy: PEER_SYNC_SEED_POLICY,
		check: async (ctx) => {
			const sparks = ctx.worker.account.get('sparks')
			return typeof sparks === 'string' && sparks.startsWith('co_z')
		},
		apply: async (ctx) => {
			const { worker, env, log } = ctx
			const { dataEngine } = worker
			const { ensureFactoriesLoaded, getAllFactories } = await import(
				'@MaiaOS/validation/factory-registry'
			)
			await ensureFactoriesLoaded()
			const { getAllVibeRegistries } = await import('@MaiaOS/universe')
			const allVibeRegistries = await getAllVibeRegistries()
			const vibeRegistries = await filterVibesForSeeding(allVibeRegistries, env.seedVibes)
			if (vibeRegistries.length === 0) {
				throw new Error(
					'[sync] Genesis requires vibes. getAllVibeRegistries returned none or SEED_VIBES filtered all.',
				)
			}
			const { configs: mergedConfigs, data } = await buildSeedConfig(vibeRegistries)
			const {
				actors: serviceActors,
				interfaces: serviceInterfaces,
				inboxes: serviceInboxes,
				contexts: actorContexts,
				views: actorViews,
				processes: actorProcesses,
				styles: actorStyles,
				wasms: serviceWasms,
			} = getSeedConfig()
			const configsForSeed = {
				...mergedConfigs,
				actors: { ...mergedConfigs.actors, ...serviceActors },
				states: mergedConfigs.states,
				interfaces: { ...(mergedConfigs.interfaces || {}), ...serviceInterfaces },
				inboxes: { ...mergedConfigs.inboxes, ...serviceInboxes },
				contexts: { ...mergedConfigs.contexts, ...(actorContexts || {}) },
				views: { ...mergedConfigs.views, ...(actorViews || {}) },
				processes: { ...mergedConfigs.processes, ...(actorProcesses || {}) },
				styles: { ...mergedConfigs.styles, ...(actorStyles || {}) },
				wasms: { ...(mergedConfigs.wasms || {}), ...(serviceWasms || {}) },
			}
			const schemas = getAllFactories()
			const seedResult = await dataEngine.execute({
				op: 'seed',
				configs: configsForSeed,
				schemas,
				data,
				forceFreshSeed: true,
			})
			if (seedResult?.ok === false && seedResult?.errors?.length) {
				const msg = seedResult.errors.map((e) => e?.message ?? e).join('; ')
				throw new Error(`[sync] Genesis seed failed: ${msg}`)
			}
			log.info(
				`Genesis seeded: ${vibeRegistries.length} vibe(s). Unset PEER_SYNC_SEED after first seed so later restarts use the persisted scaffold.`,
			)
		},
	}
}
