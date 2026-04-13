import { describe, expect, test } from 'bun:test'
import { namekeyFromFactoryDefinitionContent } from '../src/namekey-from-definition-content.js'

describe('namekeyFromFactoryDefinitionContent', () => {
	test('returns title when it matches factory ref pattern', () => {
		expect(namekeyFromFactoryDefinitionContent({ title: '°maia/factory/actor.factory.maia' })).toBe(
			'°maia/factory/actor.factory.maia',
		)
	})

	test('returns $label when title absent and $label matches', () => {
		expect(namekeyFromFactoryDefinitionContent({ $label: '°maia/factory/other.factory.maia' })).toBe(
			'°maia/factory/other.factory.maia',
		)
	})

	test('prefers title over $label when both match', () => {
		expect(
			namekeyFromFactoryDefinitionContent({
				title: '°maia/factory/a.factory.maia',
				$label: '°maia/factory/b.factory.maia',
			}),
		).toBe('°maia/factory/a.factory.maia')
	})
})
