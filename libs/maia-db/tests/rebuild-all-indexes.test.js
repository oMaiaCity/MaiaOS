import { describe, expect, test } from 'bun:test'
import { rebuildAllIndexes } from '../src/modules/cojson-impl.js'

describe('rebuildAllIndexes', () => {
	test('completes with empty coValues map', async () => {
		const peer = { getAllCoValues: () => new Map() }
		await expect(rebuildAllIndexes(peer)).resolves.toBeUndefined()
	})
})
