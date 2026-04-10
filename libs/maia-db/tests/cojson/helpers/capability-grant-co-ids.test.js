import { describe, expect, it } from 'bun:test'
import { collectCapabilityGrantCoIdsFromColistContent } from '../../../src/cojson/helpers/capability-grant-co-ids.js'

describe('collectCapabilityGrantCoIdsFromColistContent', () => {
	it('collects string co-ids from colist items array', () => {
		const ids = collectCapabilityGrantCoIdsFromColistContent({
			type: 'colist',
			items: ['co_zaaa', 'co_zbbb'],
		})
		expect(ids).toEqual(['co_zaaa', 'co_zbbb'])
	})

	it('collects from value-wrapped items', () => {
		const ids = collectCapabilityGrantCoIdsFromColistContent({
			type: 'colist',
			items: [{ value: 'co_zccc' }],
		})
		expect(ids).toEqual(['co_zccc'])
	})

	it('uses toJSON when items missing', () => {
		const content = {
			type: 'colist',
			toJSON() {
				return ['co_zddd']
			},
		}
		const ids = collectCapabilityGrantCoIdsFromColistContent(content)
		expect(ids).toEqual(['co_zddd'])
	})

	it('rejects non-colist', () => {
		expect(collectCapabilityGrantCoIdsFromColistContent({ type: 'comap', items: {} })).toEqual([])
		expect(collectCapabilityGrantCoIdsFromColistContent({ type: 'costream', items: [] })).toEqual([])
	})
})
