import { identityFromMaiaPath } from '@MaiaOS/validation/identity-from-maia-path.js'
import { describe, expect, test } from 'bun:test'
import { transformInstanceForSeeding } from '../src/ref-transform.js'

describe('transformInstanceForSeeding', () => {
	test('resolves @actors file-path actor refs to co-ids', () => {
		const actorPath = '°maia/views/sparks/actor.maia'
		const coIdMap = new Map([
			[identityFromMaiaPath('context.factory.maia').$nanoid, 'co_zFAC'],
			[identityFromMaiaPath('views/sparks/actor.maia').$nanoid, 'co_zACTOR'],
		])
		const ctx = {
			$factory: '°maia/factory/context.factory.maia',
			'@actors': { layout: actorPath },
		}
		const out = transformInstanceForSeeding(ctx, coIdMap)
		expect(out.$factory).toBe('co_zFAC')
		expect(out['@actors'].layout).toBe('co_zACTOR')
	})

	test('transforms instance refs', () => {
		const coIdMap = new Map([
			[identityFromMaiaPath('actor.factory.maia').$nanoid, 'co_zFAC'],
			[identityFromMaiaPath('x/actor.maia').$nanoid, 'co_zINST'],
		])
		const inst = {
			$factory: '°maia/factory/actor.factory.maia',
			context: '°maia/x/actor.maia',
		}
		const out = transformInstanceForSeeding(inst, coIdMap)
		expect(out.$factory).toBe('co_zFAC')
		expect(out.context).toBe('co_zINST')
	})

	test('does not resolve $label as a walkable ref (logical id stays °…)', () => {
		const coIdMap = new Map([[identityFromMaiaPath('vibe.factory.maia').$nanoid, 'co_zVIBEF']])
		const vibe = {
			$factory: '°maia/factory/vibe.factory.maia',
			$label: '°maia/vibe/chat',
		}
		const out = transformInstanceForSeeding(vibe, coIdMap)
		expect(out.$factory).toBe('co_zVIBEF')
		expect(out.$label).toBe('°maia/vibe/chat')
	})

	test('throwOnMissing false leaves unresolved ° refs in place (migrate path)', () => {
		const coIdMap = new Map()
		const inst = { inbox: '°maia/x/intent/inbox.maia' }
		const out = transformInstanceForSeeding(inst, coIdMap, { throwOnMissing: false })
		expect(out.inbox).toBe('°maia/x/intent/inbox.maia')
	})
})
