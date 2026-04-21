import { maiaFactoryRefToNanoid, maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
import { describe, expect, test } from 'bun:test'
import { sortSchemasByDependency } from '../src/orchestration/helpers.js'

describe('sortSchemasByDependency (seed: nanoid map keys)', () => {
	test('orders dependency before dependent when map is keyed by $nanoid', () => {
		const a = 'actor.factory.maia'
		const b = 'event.factory.maia'
		const nanoidA = maiaIdentity(a).$nanoid
		const nanoidB = maiaIdentity(b).$nanoid
		const refA = `°maia/factory/${a}`
		const m = new Map()
		// B references A in a nested string (as in JSON schema)
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
		const sorted = sortSchemasByDependency(m, [])
		expect(sorted.indexOf(nanoidA)).toBeLessThan(sorted.indexOf(nanoidB))
		expect(maiaFactoryRefToNanoid(refA)).toBe(nanoidA)
	})
})
