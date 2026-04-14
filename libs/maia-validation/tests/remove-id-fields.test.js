import { describe, expect, test } from 'bun:test'
import { removeIdFields } from '../src/remove-id-fields.js'

describe('removeIdFields', () => {
	test('strips top-level id', () => {
		expect(removeIdFields({ id: 'foo', $id: 'bar' })).toEqual({ $id: 'bar' })
	})

	test('preserves id in properties', () => {
		expect(
			removeIdFields({
				properties: { id: { type: 'string' } },
			}),
		).toEqual({
			properties: { id: { type: 'string' } },
		})
	})
})
