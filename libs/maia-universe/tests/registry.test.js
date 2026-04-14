import { describe, expect, test } from 'bun:test'
import { identityFromMaiaPath } from '../src/helpers/identity-from-maia-path.js'
import {
	ALL_VIBE_REGISTRIES,
	getAllVibeRegistries,
	MAIA_SPARK_REGISTRY,
	SEED_DATA,
} from '../src/registry.js'

describe('maia registry (generated)', () => {
	test('MAIA_SPARK_REGISTRY maps nanoid → annotated config for actors', () => {
		const id = identityFromMaiaPath('os/ai/actor.maia')
		expect(MAIA_SPARK_REGISTRY[id.$nanoid]).toBeDefined()
		expect(MAIA_SPARK_REGISTRY[id.$nanoid].$nanoid).toBe(id.$nanoid)
		const idSparks = identityFromMaiaPath('views/sparks/actor.maia')
		expect(MAIA_SPARK_REGISTRY[idSparks.$nanoid]).toBeDefined()
	})

	test('SEED_DATA has icons, notes, todos from data/*.data.maia', () => {
		expect(SEED_DATA.icons).toBeDefined()
		expect(SEED_DATA.notes).toBeDefined()
		expect(SEED_DATA.todos).toBeDefined()
	})

	test('SEED_DATA.icons has svg for each dashboard vibe key', () => {
		for (const k of SEED_DATA.icons.dashboardVibeKeys) {
			expect(typeof SEED_DATA.icons[k]?.svg).toBe('string')
			expect(SEED_DATA.icons[k].svg.length).toBeGreaterThan(0)
		}
	})

	test('ALL_VIBE_REGISTRIES matches registry.js discovery', async () => {
		expect(ALL_VIBE_REGISTRIES.length).toBe(8)
		const asyncList = await getAllVibeRegistries()
		expect(asyncList.length).toBe(8)
	})
})
