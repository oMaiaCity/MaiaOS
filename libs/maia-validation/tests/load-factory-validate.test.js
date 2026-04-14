import { describe, expect, test } from 'bun:test'
import { loadFactoryAndValidate } from '../src/validation.helper.js'

describe('loadFactoryAndValidate', () => {
	test('rejects non-co_z non-inline factory ref', async () => {
		await expect(
			loadFactoryAndValidate(null, 'SomeVibeFactory', {}, 'test', { dataEngine: {} }),
		).rejects.toThrow(/co_z co-id or AccountFactory\|ProfileFactory/)
	})

	test('validates ProfileFactory inline without peer bundle', async () => {
		const schema = await loadFactoryAndValidate(
			null,
			'ProfileFactory',
			{ name: 'x', avatar: 'co_zabc123' },
			'test',
			{},
		)
		expect(schema.title).toBe('Profile')
	})

	test('throws ProfileFactory on invalid data', async () => {
		await expect(
			loadFactoryAndValidate(null, 'ProfileFactory', { name: '' }, 'test', {}),
		).rejects.toThrow()
	})
})
