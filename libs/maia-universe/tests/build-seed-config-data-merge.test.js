import { describe, expect, test } from 'bun:test'
import { buildSeedConfig } from '../src/config/build-seed-config.js'
import { ALL_VIBE_REGISTRIES, SEED_DATA } from '../src/registry.js'

describe('buildSeedConfig data merge', () => {
	test('merged notes bucket matches combined seed instances from vibes', () => {
		const { data } = buildSeedConfig(ALL_VIBE_REGISTRIES)
		expect(data.notes && typeof data.notes === 'object').toBe(true)
		expect(Array.isArray(data.notes.instances)).toBe(true)
		expect(data.notes.instances.length).toBe(SEED_DATA.notes.instances.length)
	})

	test('merged todos bucket matches SEED_DATA.todos instances', () => {
		const { data } = buildSeedConfig(ALL_VIBE_REGISTRIES)
		expect(data.todos && typeof data.todos === 'object').toBe(true)
		expect(Array.isArray(data.todos.instances)).toBe(true)
		expect(data.todos.instances.length).toBe(SEED_DATA.todos.instances.length)
	})
})
