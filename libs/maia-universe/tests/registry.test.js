import { describe, expect, test } from 'bun:test'
import {
	ALL_VIBE_REGISTRIES,
	annotateMaiaByActorsPath,
	getAllVibeRegistries,
	ICON_SVG_BY_KEY,
	SEED_DATA,
} from '../src/maia/registry.js'

describe('maia registry (generated)', () => {
	test('annotateMaiaByActorsPath keys are POSIX paths under actors/', () => {
		expect(annotateMaiaByActorsPath['os/ai/actor.maia']).toBeDefined()
		expect(annotateMaiaByActorsPath['views/sparks/actor.maia']).toBeDefined()
		const keys = Object.keys(annotateMaiaByActorsPath).sort()
		for (let i = 1; i < keys.length; i++) {
			expect(keys[i - 1] < keys[i]).toBe(true)
		}
	})

	test('SEED_DATA has icons, notes, todos from data/*.data.maia', () => {
		expect(SEED_DATA.icons).toBeDefined()
		expect(SEED_DATA.notes).toBeDefined()
		expect(SEED_DATA.todos).toBeDefined()
	})

	test('dashboard icon SVG map covers vibe keys', () => {
		for (const k of SEED_DATA.icons.dashboardVibeKeys) {
			expect(typeof ICON_SVG_BY_KEY[k]).toBe('string')
			expect(ICON_SVG_BY_KEY[k].length).toBeGreaterThan(0)
		}
	})

	test('ALL_VIBE_REGISTRIES matches registry.js discovery', async () => {
		expect(ALL_VIBE_REGISTRIES.length).toBe(8)
		const asyncList = await getAllVibeRegistries()
		expect(asyncList.length).toBe(8)
	})
})
