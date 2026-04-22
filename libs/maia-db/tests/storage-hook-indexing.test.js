import { describe, expect, test } from 'bun:test'
import {
	extractHeaderFromStorageMessage,
	readHeaderAndContent,
} from '../src/cojson/indexing/factory-index-manager.js'

describe('msg-based indexing helpers', () => {
	test('extractHeaderFromStorageMessage reads top-level header', () => {
		const h = { meta: { $factory: 'co_z1' } }
		expect(extractHeaderFromStorageMessage({ header: h })).toBe(h)
	})

	test('readHeaderAndContent returns null content when not verified', () => {
		const core = {
			id: 'co_z1',
			hasVerifiedContent: () => false,
		}
		const peer = { getHeader: () => null }
		const r = readHeaderAndContent(peer, core)
		expect(r.content).toBe(null)
	})
})

describe('indexFromMessage export', () => {
	test('is exported', async () => {
		const { indexFromMessage } = await import('../src/cojson/indexing/factory-index-manager.js')
		expect(typeof indexFromMessage).toBe('function')
	})
})
