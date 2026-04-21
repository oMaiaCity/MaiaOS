import * as db from '@MaiaOS/db'
import { INFRA_SLOTS } from '@MaiaOS/db'
import * as vh from '@MaiaOS/validation/validation.helper.js'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as ch from '../../maia-db/src/cojson/crud/collection-helpers.js'

const osId = 'co_zos_runtime_test_1'

function makeFullOsContent() {
	return {
		get(k) {
			for (const s of INFRA_SLOTS) {
				if (s.slotKey === k) return `co_zmock_${s.infraKey}`
			}
		},
	}
}

const osCore = { isAvailable: () => true, id: osId }

describe('DataEngine.resolveSystemFactories', () => {
	afterEach(() => {
		try {
			ch.ensureCoValueLoaded?.mockRestore?.()
		} catch {
			/* no-op */
		}
		try {
			db.getSparkOsId?.mockRestore?.()
		} catch {
			/* no-op */
		}
		try {
			vh.hydrateValidationMetaFromPeer?.mockRestore?.()
		} catch {
			/* no-op */
		}
	})

	test('one ensureCoValueLoaded (spark.os), peer.infra filled, cobinary on DataEngine', async () => {
		const elSpy = spyOn(ch, 'ensureCoValueLoaded')
		elSpy.mockImplementation(async () => osCore)
		const gSpy = spyOn(db, 'getSparkOsId')
		gSpy.mockImplementation(async () => osId)
		const hSpy = spyOn(vh, 'hydrateValidationMetaFromPeer')
		hSpy.mockImplementation(async () => {})

		const peer = {
			systemSparkCoId: 'co_zspark1',
			getCurrentContent: (core) => (core === osCore ? makeFullOsContent() : null),
		}
		const { DataEngine } = await import('../src/engines/data.engine.js')
		const de = new DataEngine(peer, {})
		await de.resolveSystemFactories()

		expect(elSpy.mock.calls.length).toBe(1)
		expect(elSpy.mock.calls[0][1]).toBe(osId)
		expect(de.cobinaryFactoryCoId).toBe('co_zmock_cobinary')
		expect(peer.infra.cobinary).toBe('co_zmock_cobinary')
		for (const s of INFRA_SLOTS) {
			expect(peer.infra[s.infraKey]).toMatch(/^co_zmock_/)
		}
	})

	test('missing spark.os slot fails fast with slot name', async () => {
		const elSpy = spyOn(ch, 'ensureCoValueLoaded')
		elSpy.mockImplementation(async () => osCore)
		const gSpy = spyOn(db, 'getSparkOsId')
		gSpy.mockImplementation(async () => osId)
		const hSpy = spyOn(vh, 'hydrateValidationMetaFromPeer')
		hSpy.mockImplementation(async () => {})
		const badOs = {
			get: (k) => (k === INFRA_SLOTS[0].slotKey ? 'not_coz' : 'co_zok'),
		}
		const peer = {
			systemSparkCoId: 'co_zspark1',
			getCurrentContent: () => badOs,
		}
		const { DataEngine } = await import('../src/engines/data.engine.js')
		const de = new DataEngine(peer, {})
		await expect(de.resolveSystemFactories()).rejects.toThrow(/metaFactoryCoId|not co_z|slot/)
	})
})
