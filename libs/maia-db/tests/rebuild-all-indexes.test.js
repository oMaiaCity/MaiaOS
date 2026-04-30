import { describe, expect, test } from 'bun:test'
import { rebuildAllIndexes } from '../src/cojson/indexing/factory-index-rebuild.js'

describe('rebuildAllIndexes', () => {
	test('completes with empty coValues map', async () => {
		const peer = { getAllCoValues: () => new Map() }
		await expect(rebuildAllIndexes(peer)).resolves.toBeUndefined()
	})
})
