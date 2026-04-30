/**
 * Genesis-only surface: vibe merge + seed tables. No ref-transform barrel — loaded only when genesis runs.
 */
export {
	buildSeedConfig,
	getSeedConfig,
	SEED_DATA,
} from '@MaiaOS/universe/config/build-seed-config.js'
export {
	filterVibesForSeeding,
	getDependenciesForVibes,
	getVibeActorConfigs,
} from '@MaiaOS/universe/config/vibe-seed-helpers.js'
