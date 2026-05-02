import { maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
import { describe, expect, test } from 'bun:test'
import { transformInstanceForSeeding } from '../src/avens/maia/helpers/seed/ref-transform.js'

describe('transformInstanceForSeeding', () => {
	test('resolves @actors file-path actor refs to co-ids', () => {
		const actorPath = '°maia/views/sparks/actor.json'
		const coIdMap = new Map([
			[maiaIdentity('context.factory.json').$nanoid, 'co_zFAC'],
			[maiaIdentity('views/sparks/actor.json').$nanoid, 'co_zACTOR'],
		])
		const ctx = {
			$factory: '°maia/factory/context.factory.json',
			'@actors': { layout: actorPath },
		}
		const out = transformInstanceForSeeding(ctx, coIdMap)
		expect(out.$factory).toBe('co_zFAC')
		expect(out['@actors'].layout).toBe('co_zACTOR')
	})

	test('transforms instance refs', () => {
		const coIdMap = new Map([
			[maiaIdentity('actor.factory.json').$nanoid, 'co_zFAC'],
			[maiaIdentity('x/actor.json').$nanoid, 'co_zINST'],
		])
		const inst = {
			$factory: '°maia/factory/actor.factory.json',
			context: '°maia/x/actor.json',
		}
		const out = transformInstanceForSeeding(inst, coIdMap)
		expect(out.$factory).toBe('co_zFAC')
		expect(out.context).toBe('co_zINST')
	})

	test('does not resolve $label as a walkable ref (logical id stays °…)', () => {
		const coIdMap = new Map([[maiaIdentity('vibe.factory.json').$nanoid, 'co_zVIBEF']])
		const vibe = {
			$factory: '°maia/factory/vibe.factory.json',
			$label: '°maia/vibe/chat',
		}
		const out = transformInstanceForSeeding(vibe, coIdMap)
		expect(out.$factory).toBe('co_zVIBEF')
		expect(out.$label).toBe('°maia/vibe/chat')
	})

	test('throwOnMissing false leaves unresolved ° refs in place (migrate path)', () => {
		const coIdMap = new Map()
		const inst = { inbox: '°maia/x/intent/inbox.json' }
		const out = transformInstanceForSeeding(inst, coIdMap, { throwOnMissing: false })
		expect(out.inbox).toBe('°maia/x/intent/inbox.json')
	})
})
