import { maiaFactoryRefToNanoid, maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
import { describe, expect, test } from 'bun:test'
import { sortFactoriesByDependency } from '../src/avens/maia/helpers/seed/seed-helpers.js'

describe('sortFactoriesByDependency (seed: nanoid map keys)', () => {
	test('orders dependency before dependent when map is keyed by $nanoid', () => {
		const a = 'actor.factory.json'
		const b = 'event.factory.json'
		const nanoidA = maiaIdentity(a).$nanoid
		const nanoidB = maiaIdentity(b).$nanoid
		const refA = `°maia/factory/${a}`
		const m = new Map()
		m.set(nanoidB, {
			name: 'event',
			schema: {
				$nanoid: nanoidB,
				definition: { nested: { x: refA } },
			},
		})
		m.set(nanoidA, {
			name: 'actor',
			schema: { $nanoid: nanoidA, definition: {} },
		})
		const sorted = sortFactoriesByDependency(m, [])
		expect(sorted.indexOf(nanoidA)).toBeLessThan(sorted.indexOf(nanoidB))
		expect(maiaFactoryRefToNanoid(refA)).toBe(nanoidA)
	})
})
