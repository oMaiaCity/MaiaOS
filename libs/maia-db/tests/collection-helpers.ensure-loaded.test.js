import { describe, expect, test } from 'bun:test'
import { ensureCoValueAvailable, ensureCoValueLoaded } from '../src/modules/cojson-impl.js'

describe('ensureCoValueLoaded', () => {
	test('acquires core when getCoValue is null until loadCoValueCore registers it', async () => {
		const coId = 'co_zacquiretest'
		let core = null
		const mockCore = {
			id: coId,
			isAvailable: () => true,
			subscribe: () => () => {},
		}
		const peer = {
			getCoValue: (id) => (id === coId ? core : null),
			node: {
				getCoValue: () => null,
				loadCoValueCore: async (id) => {
					if (id === coId) core = mockCore
				},
			},
		}
		const out = await ensureCoValueLoaded(peer, coId, { waitForAvailable: false })
		expect(out).toBe(mockCore)
	})

	test('waits for availability when waitForAvailable is true', async () => {
		const coId = 'co_zwaitavail'
		let available = false
		const mockCore = {
			id: coId,
			isAvailable: () => available,
			subscribe: (fn) => {
				queueMicrotask(() => {
					available = true
					fn(mockCore)
				})
				return () => {}
			},
		}
		const peer = {
			getCoValue: () => mockCore,
			node: {
				loadCoValueCore: async () => {},
			},
		}
		const out = await ensureCoValueLoaded(peer, coId, {
			waitForAvailable: true,
			timeoutMs: 5000,
		})
		expect(out).toBe(mockCore)
		expect(available).toBe(true)
	})
})

describe('ensureCoValueAvailable', () => {
	test('delegates to ensureCoValueLoaded and returns core when ready', async () => {
		const coId = 'co_zdeleg'
		const mockCore = {
			id: coId,
			isAvailable: () => true,
			subscribe: () => () => {},
		}
		const peer = {
			getCoValue: () => mockCore,
			node: {},
		}
		const out = await ensureCoValueAvailable(peer, coId, 'testOp')
		expect(out).toBe(mockCore)
	})
})
