import { MAIA_SPARK_REGISTRY as REG_ACTORS } from '../../migrations/004-actors/generated.js'
import {
	ALL_VIBE_REGISTRIES,
	getAllVibeRegistries,
	MAIA_SPARK_REGISTRY as REG_VIBES,
	SEED_DATA,
} from '../../migrations/005-vibes/generated.js'

export const MAIA_SPARK_REGISTRY = Object.freeze({
	...REG_VIBES,
	...REG_ACTORS,
})

export { ALL_VIBE_REGISTRIES, getAllVibeRegistries, SEED_DATA }
