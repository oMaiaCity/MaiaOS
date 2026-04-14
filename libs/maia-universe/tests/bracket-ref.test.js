import { describe, expect, test } from 'bun:test'
import { parseDataMaiaBracketRef } from '../src/helpers/bracket-ref.js'

describe('parseDataMaiaBracketRef', () => {
	test('parses icons data bracket ref', () => {
		const r = parseDataMaiaBracketRef('°maia/data/icons.data.maia[dw5wMME7GWnX]')
		expect(r).toEqual({
			dataFile: 'icons.data.maia',
			itemNanoid: 'dw5wMME7GWnX',
			pathKey: 'data/icons.data.maia',
		})
	})

	test('returns null for non-data ref', () => {
		expect(parseDataMaiaBracketRef('°maia/factory/note.factory.maia')).toBe(null)
	})

	test('returns null for malformed bracket', () => {
		expect(parseDataMaiaBracketRef('°maia/data/icons.data.maia')).toBe(null)
	})
})
