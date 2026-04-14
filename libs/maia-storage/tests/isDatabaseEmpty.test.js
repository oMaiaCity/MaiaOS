import { describe, expect, test } from 'bun:test'
import { isDatabaseEmptyFromQueryInterface } from '../src/isDatabaseEmpty.js'

describe('isDatabaseEmptyFromQueryInterface', () => {
	test('returns true when every table query throws (no tables)', async () => {
		const db = {
			query: async () => {
				throw new Error('no such table')
			},
		}
		expect(await isDatabaseEmptyFromQueryInterface(db)).toBe(true)
	})

	test('returns false when any table returns a row', async () => {
		let calls = 0
		const db = {
			query: async () => {
				calls++
				if (calls === 1) return { rows: [{ x: 1 }] }
				return { rows: [] }
			},
		}
		expect(await isDatabaseEmptyFromQueryInterface(db)).toBe(false)
	})
})
