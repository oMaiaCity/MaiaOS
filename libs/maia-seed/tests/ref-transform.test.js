import { describe, expect, test } from 'bun:test'
import { transformForSeeding } from '../src/ref-transform.js'

describe('transformForSeeding', () => {
	test('resolves @actors file-path actor refs to co-ids', () => {
		const actorPath = '°maia/views/sparks/actor.maia'
		const coIdMap = new Map([
			['°maia/factory/context', 'co_zFAC'],
			[actorPath, 'co_zACTOR'],
		])
		const ctx = {
			$factory: '°maia/factory/context',
			'@actors': { layout: actorPath },
		}
		const out = transformForSeeding(ctx, coIdMap)
		expect(out.$factory).toBe('co_zFAC')
		expect(out['@actors'].layout).toBe('co_zACTOR')
	})

	test('uses $factory only for instance detection (not $schema)', () => {
		const coIdMap = new Map([
			['°maia/factory/actor', 'co_zFAC'],
			['°maia/x/actor.maia', 'co_zINST'],
		])
		const inst = {
			$factory: '°maia/factory/actor',
			context: '°maia/x/actor.maia',
		}
		const out = transformForSeeding(inst, coIdMap)
		expect(out.$factory).toBe('co_zFAC')
		expect(out.context).toBe('co_zINST')
	})
})
