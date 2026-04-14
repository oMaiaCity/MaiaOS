import { describe, expect, test } from 'bun:test'
import {
	logicalRefToSeedNanoid,
	maiaFactoryLabel,
	maiaIdentity,
} from '../src/identity-from-maia-path.js'

describe('maiaIdentity', () => {
	test('instance path → $label + $nanoid + executableKey', () => {
		const o = maiaIdentity('services/ai/actor.maia')
		expect(o.$label).toBe('°maia/services/ai/actor.maia')
		expect(o.executableKey).toBe('maia/services/ai')
		expect(o.$nanoid.length).toBe(12)
	})

	test('factory basename → $label + nanoid; executableKey null', () => {
		const o = maiaIdentity('actor.factory.maia')
		expect(o.$label).toBe('°maia/factory/actor.factory.maia')
		expect(o.executableKey).toBeNull()
		expect(o.$nanoid.length).toBe(12)
	})

	test('rejects ° prefix', () => {
		expect(() => maiaIdentity('°maia/services/ai/actor.maia')).toThrow(
			/sparkRelPath must not start with °/,
		)
	})

	test('rejects maia/ prefix', () => {
		expect(() => maiaIdentity('maia/services/ai/actor.maia')).toThrow(
			/must not include a maia\/ prefix/,
		)
	})
})

describe('logicalRefToSeedNanoid', () => {
	test('factory logical ref matches maiaIdentity basename', () => {
		const fromSpark = maiaIdentity('meta.factory.maia').$nanoid
		const fromLogical = logicalRefToSeedNanoid('°maia/factory/meta.factory.maia')
		expect(fromLogical).toBe(fromSpark)
		expect(logicalRefToSeedNanoid('°maia/factory/event.factory.maia')).toBe(
			maiaIdentity('event.factory.maia').$nanoid,
		)
	})
})

describe('maiaFactoryLabel', () => {
	test('basename → °maia/factory/...', () => {
		expect(maiaFactoryLabel('actor.factory.maia')).toBe('°maia/factory/actor.factory.maia')
		expect(maiaFactoryLabel('todos.factory.maia')).toBe('°maia/factory/todos.factory.maia')
	})
})
