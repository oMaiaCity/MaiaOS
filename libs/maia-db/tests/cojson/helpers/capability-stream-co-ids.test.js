import { describe, expect, test } from 'bun:test'
import { collectCapabilityGrantCoIdsFromStreamContent } from '../../../src/cojson/helpers/capability-stream-co-ids.js'

describe('collectCapabilityGrantCoIdsFromStreamContent', () => {
	test('session map shape (sync peer)', () => {
		const ids = collectCapabilityGrantCoIdsFromStreamContent({
			type: 'costream',
			items: {
				sess1: [{ value: 'co_zAAA', tx: 1, madeAt: 0 }],
				sess2: [{ value: 'co_zBBB', tx: 2, madeAt: 0 }],
			},
		})
		expect(ids.sort()).toEqual(['co_zAAA', 'co_zBBB'].sort())
	})

	test('flat items array (MaiaDB store)', () => {
		const ids = collectCapabilityGrantCoIdsFromStreamContent({
			type: 'costream',
			items: ['co_zX', { value: 'co_zY' }],
		})
		expect(ids.sort()).toEqual(['co_zX', 'co_zY'].sort())
	})

	test('toJSON fallback when items missing', () => {
		const content = {
			type: 'costream',
			items: undefined,
			toJSON() {
				return { a: [{ value: 'co_zFromJSON' }] }
			},
		}
		const ids = collectCapabilityGrantCoIdsFromStreamContent(content)
		expect(ids).toEqual(['co_zFromJSON'])
	})

	test('rejects non-costream', () => {
		expect(collectCapabilityGrantCoIdsFromStreamContent({ type: 'comap', items: {} })).toEqual([])
	})

	test('empty stream', () => {
		expect(collectCapabilityGrantCoIdsFromStreamContent({ type: 'costream', items: {} })).toEqual([])
		expect(collectCapabilityGrantCoIdsFromStreamContent({ type: 'costream', items: [] })).toEqual([])
	})
})
