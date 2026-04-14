import { beforeAll, describe, expect, test } from 'bun:test'
import { ensureFactoriesLoaded, getAllFactories } from '../src/factory-registry.js'
import {
	identityFromMaiaPath,
	logicalRefToSeedNanoid,
	maiaFactoryLabel,
	withCanonicalFactorySchema,
} from '../src/identity-from-maia-path.js'

beforeAll(async () => {
	await ensureFactoriesLoaded()
})

describe('identityFromMaiaPath', () => {
	test('instance path → $label + $nanoid', () => {
		const o = identityFromMaiaPath('actors/os/ai/actor.maia')
		expect(o.$label).toBe('°maia/actors/os/ai/actor.maia')
		expect(o.$nanoid.length).toBe(12)
	})

	test('factory basename → derived °maia/factory/<basename>', () => {
		const o = identityFromMaiaPath('actor.factory.maia')
		expect(o.$label).toBe('°maia/factory/actor.factory.maia')
	})

	test('logical °maia/factory/<basename> matches basename identity (seed / registry)', () => {
		const fromLabel = identityFromMaiaPath('meta.factory.maia').$nanoid
		const fromLogical = logicalRefToSeedNanoid('°maia/factory/meta.factory.maia')
		expect(fromLogical).toBe(fromLabel)
		expect(logicalRefToSeedNanoid('°maia/factory/event.factory.maia')).toBe(
			identityFromMaiaPath('event.factory.maia').$nanoid,
		)
	})
})

describe('maiaFactoryLabel', () => {
	test('prefixes basename', () => {
		expect(maiaFactoryLabel('actor.factory.maia')).toBe('°maia/factory/actor.factory.maia')
		expect(maiaFactoryLabel('todos.factory.maia')).toBe('°maia/factory/todos.factory.maia')
	})
})

describe('identity-from-maia-path (M4)', () => {
	test('getAllFactories injects matching $label for each schema', () => {
		const all = getAllFactories()
		for (const schema of Object.values(all)) {
			expect(typeof schema.$label).toBe('string')
			expect(schema.$label.startsWith('°maia/factory/')).toBe(true)
		}
	})

	test('withCanonicalFactorySchema sets $label + $nanoid', () => {
		const out = withCanonicalFactorySchema(
			{ $factory: '°maia/factory/meta.factory.maia', x: 1 },
			'actor.factory.maia',
		)
		expect(out.$label).toBe('°maia/factory/actor.factory.maia')
		expect(typeof out.$nanoid).toBe('string')
		expect(out.$nanoid.length).toBe(12)
		expect(out.x).toBe(1)
	})
})
