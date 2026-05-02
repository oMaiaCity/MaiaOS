import { describe, expect, test } from 'bun:test'
import { normalizeCoValueData } from '../src/primitives/data-extraction.js'

describe('normalizeCoValueData', () => {
	test('drops maiaPathKey from persisted-shaped objects (not exposed to clients)', () => {
		expect(
			normalizeCoValueData({
				foo: 1,
				maiaPathKey: 'maia/services/paper/process.json',
				nested: { maiaPathKey: 'x' },
			}),
		).toEqual({
			foo: 1,
			nested: {},
		})
	})
})
