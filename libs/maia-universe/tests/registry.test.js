import { describe, expect, test } from 'bun:test'
import { maiaIdentity } from '../src/helpers/identity-from-maia-path.js'
import {
	ALL_VIBE_REGISTRIES,
	getAllVibeRegistries,
	MAIA_SPARK_REGISTRY,
	SEED_DATA,
} from '../src/registry.js'

describe('maia registry (generated)', () => {
	test('MAIA_SPARK_REGISTRY maps nanoid → annotated config for actors', () => {
		const id = maiaIdentity('services/ai/actor.maia')
		expect(MAIA_SPARK_REGISTRY[id.$nanoid]).toBeDefined()
		expect(MAIA_SPARK_REGISTRY[id.$nanoid].$nanoid).toBe(id.$nanoid)
		const idSparks = maiaIdentity('views/sparks/actor.maia')
		expect(MAIA_SPARK_REGISTRY[idSparks.$nanoid]).toBeDefined()
	})

	test('SEED_DATA has icons, notes, todos from data/*.data.maia', () => {
		expect(SEED_DATA.icons).toBeDefined()
		expect(SEED_DATA.notes).toBeDefined()
		expect(SEED_DATA.todos).toBeDefined()
	})

	test('SEED_DATA.icons instances each have svg', () => {
		expect(Array.isArray(SEED_DATA.icons.instances)).toBe(true)
		for (const row of SEED_DATA.icons.instances) {
			expect(typeof row.svg).toBe('string')
			expect(row.svg.length).toBeGreaterThan(0)
		}
	})

	test('ALL_VIBE_REGISTRIES matches registry.js discovery', async () => {
		const asyncList = await getAllVibeRegistries()
		const withVibe = ALL_VIBE_REGISTRIES.filter((R) => R?.vibe)
		expect(asyncList).toEqual(withVibe)
	})
})
