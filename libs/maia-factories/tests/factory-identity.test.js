import { describe, expect, test } from 'bun:test'
import { FACTORY_PATH_TO_REF, withCanonicalFactorySchema } from '../src/factory-identity.js'
import { getAllFactories } from '../src/index.js'

describe('factory-identity (M4)', () => {
	test('every FACTORY_PATH_TO_REF value is °maia/factory/...', () => {
		for (const ref of Object.values(FACTORY_PATH_TO_REF)) {
			expect(ref.startsWith('°maia/factory/')).toBe(true)
		}
	})

	test('getAllFactories injects matching $id for each schema', () => {
		const all = getAllFactories()
		for (const schema of Object.values(all)) {
			expect(typeof schema.$id).toBe('string')
			expect(schema.$id.startsWith('°maia/factory/')).toBe(true)
		}
	})

	test('withCanonicalFactorySchema sets $id', () => {
		const out = withCanonicalFactorySchema(
			{ $factory: '°maia/factory/meta', x: 1 },
			'os/actor.factory.json',
		)
		expect(out.$id).toBe('°maia/factory/actor')
		expect(out.x).toBe(1)
	})
})
