import { describe, expect, test } from 'bun:test'
import { INSTANCE_REF_PATTERN, isFactoryRef, isInstanceRef, isVibeRef } from '../src/patterns.js'

describe('INSTANCE_REF_PATTERN', () => {
	test('matches file-path instance refs', () => {
		expect(INSTANCE_REF_PATTERN.test('°maia/views/sparks/actor.json')).toBe(true)
		expect(INSTANCE_REF_PATTERN.test('°maia/services/spark/context.json')).toBe(true)
		expect(INSTANCE_REF_PATTERN.test('°maia/brand/maiacity.style.json')).toBe(true)
	})

	test('matches vibe keys without file suffix', () => {
		expect(INSTANCE_REF_PATTERN.test('°maia/vibe/todos')).toBe(true)
	})

	test('does not match factory refs', () => {
		expect(INSTANCE_REF_PATTERN.test('°maia/factory/actor.factory.json')).toBe(false)
		expect(INSTANCE_REF_PATTERN.test('°maia/factory/meta.factory.json')).toBe(false)
	})

	test('isInstanceRef aligns with pattern', () => {
		expect(isInstanceRef('°maia/services/db/actor.json')).toBe(true)
		expect(isInstanceRef('°maia/factory/actor.factory.json')).toBe(false)
	})
})

describe('FACTORY_REF_PATTERN', () => {
	test('isFactoryRef', () => {
		expect(isFactoryRef('°maia/factory/actor.factory.json')).toBe(true)
		expect(isFactoryRef('°maia/views/x.json')).toBe(false)
	})
})

describe('VIBE_REF_PATTERN', () => {
	test('isVibeRef', () => {
		expect(isVibeRef('°maia/vibe/todos')).toBe(true)
		expect(isVibeRef('°maia/todos/x.json')).toBe(false)
	})
})
