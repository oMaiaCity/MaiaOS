import { describe, expect, test } from 'bun:test'
import { namekeyFromFactoryDefinitionContent } from '../src/namekey-from-definition-content.js'

describe('namekeyFromFactoryDefinitionContent', () => {
	test('returns title when it matches factory ref pattern', () => {
		expect(namekeyFromFactoryDefinitionContent({ title: '°maia/factory/event' })).toBe(
			'°maia/factory/event',
		)
	})

	test('returns $id when title is absent and $id matches', () => {
		expect(namekeyFromFactoryDefinitionContent({ $id: '°maia/factory/other' })).toBe(
			'°maia/factory/other',
		)
	})

	test('prefers title over $id when both match', () => {
		expect(
			namekeyFromFactoryDefinitionContent({
				title: '°maia/factory/a',
				$id: '°maia/factory/b',
			}),
		).toBe('°maia/factory/a')
	})

	test('works with CoMap-like .get', () => {
		const content = {
			get(k) {
				if (k === 'title') return '°maia/factory/x'
				return undefined
			},
		}
		expect(namekeyFromFactoryDefinitionContent(content)).toBe('°maia/factory/x')
	})

	test('returns null for non-matching strings', () => {
		expect(namekeyFromFactoryDefinitionContent({ title: 'plain' })).toBe(null)
		expect(namekeyFromFactoryDefinitionContent(null)).toBe(null)
	})
})
