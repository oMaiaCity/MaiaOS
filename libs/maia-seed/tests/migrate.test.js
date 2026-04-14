import { describe, expect, test } from 'bun:test'
import {
	buildRegistryMapFromNanoidIndex,
	stripKeysWithUnresolvedRefs,
} from '../src/orchestration/migrate.js'

describe('stripKeysWithUnresolvedRefs', () => {
	test('removes top-level keys containing unresolved ° anywhere in value', () => {
		const o = {
			$label: '°maia/vibe/x',
			inbox: '°maia/x/inbox.maia',
			ok: 'co_zabc',
			tabs: [{ id: 'a', actor: '°maia/y' }],
			clean: [{ id: 'b', actor: 'co_zdef' }],
			nested: { a: '°maia/y', b: 'co_zdef' },
		}
		const removed = stripKeysWithUnresolvedRefs(o)
		expect(o.$label).toBe('°maia/vibe/x')
		expect(o.inbox).toBeUndefined()
		expect(removed.has('inbox')).toBe(true)
		expect(o.ok).toBe('co_zabc')
		expect(o.tabs).toBeUndefined()
		expect(removed.has('tabs')).toBe(true)
		expect(o.clean).toEqual([{ id: 'b', actor: 'co_zdef' }])
		expect(o.nested).toBeUndefined()
		expect(removed.has('nested')).toBe(true)
	})
})

describe('buildRegistryMapFromNanoidIndex', () => {
	test('merges spark.os.nanoids entries and peer.systemFactoryCoIds', () => {
		const nanoidContent = {
			keys() {
				return ['n1']
			},
			get(k) {
				return k === 'n1' ? 'co_z111' : undefined
			},
		}
		const peer = { systemFactoryCoIds: new Map([['n2', 'co_z222']]) }
		const m = buildRegistryMapFromNanoidIndex(nanoidContent, peer)
		expect(m.get('n1')).toBe('co_z111')
		expect(m.get('n2')).toBe('co_z222')
	})
})
