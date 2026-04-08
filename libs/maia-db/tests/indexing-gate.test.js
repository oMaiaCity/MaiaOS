import { describe, expect, test } from 'bun:test'
import { factoryDefAllowsInstanceIndexing } from '../src/cojson/indexing/factory-index-manager.js'

describe('factoryDefAllowsInstanceIndexing', () => {
	test('true only when indexing is strictly true', () => {
		expect(factoryDefAllowsInstanceIndexing({ indexing: true })).toBe(true)
		expect(factoryDefAllowsInstanceIndexing({ indexing: false })).toBe(false)
		expect(factoryDefAllowsInstanceIndexing({})).toBe(false)
		expect(factoryDefAllowsInstanceIndexing(null)).toBe(false)
		expect(factoryDefAllowsInstanceIndexing(undefined)).toBe(false)
	})
})
