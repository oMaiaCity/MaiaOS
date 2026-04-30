import { describe, expect, test } from 'bun:test'
import { ensureCoValueLoaded } from '../src/primitives/ensure-covalue-core.js'

/** Direct tests for the core loader (indexing + extraction use this instead of collection-helpers). */
describe('ensure-covalue-core', () => {
	test('ensureCoValueLoaded returns core when already available', async () => {
		const coId = 'co_zcore1'
		const mockCore = {
			id: coId,
			isAvailable: () => true,
			subscribe: () => () => {},
		}
		const peer = {
			getCoValue: () => mockCore,
			node: {},
		}
		const out = await ensureCoValueLoaded(peer, coId, { waitForAvailable: false })
		expect(out).toBe(mockCore)
	})
})
