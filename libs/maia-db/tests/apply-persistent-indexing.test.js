import { describe, expect, test } from 'bun:test'
import { applyPersistentCoValueIndexing } from '../src/modules/cojson-impl.js'

describe('applyPersistentCoValueIndexing', () => {
	test('is the single storage-hook entry for post-persist indexing', () => {
		expect(typeof applyPersistentCoValueIndexing).toBe('function')
		expect(applyPersistentCoValueIndexing.length).toBe(2)
	})
})
