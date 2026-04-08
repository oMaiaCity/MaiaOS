import { describe, expect, test } from 'bun:test'
import { applyPersistentCoValueIndexing } from '../src/cojson/indexing/factory-index-manager.js'

describe('applyPersistentCoValueIndexing', () => {
	test('is the single storage-hook entry for post-persist indexing', () => {
		expect(typeof applyPersistentCoValueIndexing).toBe('function')
		expect(applyPersistentCoValueIndexing.length).toBe(2)
	})
})
