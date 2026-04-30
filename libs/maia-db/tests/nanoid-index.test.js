import { describe, expect, test } from 'bun:test'
import {
	ensureNanoidIndexCoMap,
	loadNanoidIndex,
	NANOID_INDEX_KEY,
} from '../src/modules/cojson-impl.js'

describe('nanoid index API', () => {
	test('exports loadNanoidIndex, ensureNanoidIndexCoMap, NANOID_INDEX_KEY', () => {
		expect(typeof loadNanoidIndex).toBe('function')
		expect(typeof ensureNanoidIndexCoMap).toBe('function')
		expect(NANOID_INDEX_KEY).toBe('@nanoids')
	})
})
