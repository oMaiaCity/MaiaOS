import { describe, expect, test } from 'bun:test'
import { buildSeedConfig } from '../src/config/build-seed-config.js'
import { ALL_VIBE_REGISTRIES, SEED_DATA } from '../src/registry.js'

describe('buildSeedConfig data merge', () => {
	test('concatenates notes across vibes (chat + paper)', () => {
		const { data } = buildSeedConfig(ALL_VIBE_REGISTRIES)
		const chatLen = SEED_DATA.notes.chat?.length ?? 0
		const paperLen = SEED_DATA.notes.paper?.length ?? 0
		expect(Array.isArray(data.notes)).toBe(true)
		expect(data.notes.length).toBe(chatLen + paperLen)
	})

	test('todos array length matches SEED_DATA.todos.todos', () => {
		const { data } = buildSeedConfig(ALL_VIBE_REGISTRIES)
		const expected = SEED_DATA.todos.todos?.length ?? 0
		expect(Array.isArray(data.todos)).toBe(true)
		expect(data.todos.length).toBe(expected)
	})
})
