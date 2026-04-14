import { describe, expect, test } from 'bun:test'
import {
	ensureNanoidIndexCoMap,
	loadNanoidIndex,
} from '../src/cojson/indexing/factory-index-manager.js'

describe('nanoid index API', () => {
	test('exports loadNanoidIndex and ensureNanoidIndexCoMap', () => {
		expect(typeof loadNanoidIndex).toBe('function')
		expect(typeof ensureNanoidIndexCoMap).toBe('function')
	})
})
