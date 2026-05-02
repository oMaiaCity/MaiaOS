import { describe, expect, test } from 'bun:test'
import {
	logicalRefToSeedNanoid,
	maiaFactoryLabel,
	maiaIdentity,
} from '../src/identity-from-maia-path.js'

describe('maiaIdentity', () => {
	test('instance path → $label + $nanoid + executableKey', () => {
		const o = maiaIdentity('services/ai/actor.json')
		expect(o.$label).toBe('°maia/services/ai/actor.json')
		expect(o.executableKey).toBe('maia/services/ai')
		expect(o.$nanoid.length).toBe(12)
	})

	test('factory basename → $label + nanoid; executableKey null', () => {
		const o = maiaIdentity('actor.factory.json')
		expect(o.$label).toBe('°maia/factory/actor.factory.json')
		expect(o.executableKey).toBeNull()
		expect(o.$nanoid.length).toBe(12)
	})

	test('rejects ° prefix', () => {
		expect(() => maiaIdentity('°maia/services/ai/actor.json')).toThrow(
			/sparkRelPath must not start with °/,
		)
	})

	test('rejects maia/ prefix', () => {
		expect(() => maiaIdentity('maia/services/ai/actor.json')).toThrow(
			/must not include a maia\/ prefix/,
		)
	})
})

describe('logicalRefToSeedNanoid', () => {
	test('factory logical ref matches maiaIdentity basename', () => {
		const fromSpark = maiaIdentity('meta.factory.json').$nanoid
		const fromLogical = logicalRefToSeedNanoid('°maia/factory/meta.factory.json')
		expect(fromLogical).toBe(fromSpark)
		expect(logicalRefToSeedNanoid('°maia/factory/event.factory.json')).toBe(
			maiaIdentity('event.factory.json').$nanoid,
		)
	})
})

describe('maiaFactoryLabel', () => {
	test('basename → °maia/factory/...', () => {
		expect(maiaFactoryLabel('actor.factory.json')).toBe('°maia/factory/actor.factory.json')
		expect(maiaFactoryLabel('todos.factory.json')).toBe('°maia/factory/todos.factory.json')
	})
})
