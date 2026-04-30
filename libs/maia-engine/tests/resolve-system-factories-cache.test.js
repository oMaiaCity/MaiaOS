import * as db from '@MaiaOS/db'
import { INFRA_SLOTS } from '@MaiaOS/db'
import * as vh from '@MaiaOS/validation/validation.helper.js'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as ch from '../../maia-db/src/modules/cojson-impl.js'

const osId = 'co_zos_cache_test_1'

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

describe('DataEngine.resolveSystemFactories in-flight cache', () => {
	afterEach(() => {
		for (const fn of [
			ch.ensureCoValueLoaded,
			db.getSparkOsId,
			vh.hydrateValidationMetaFromPeer,
			db.loadInfraFromSparkOs,
		]) {
			try {
				fn?.mockRestore?.()
			} catch {
				/* no-op */
			}
		}
	})

	test('two concurrent calls share a single loadInfraFromSparkOs', async () => {
		spyOn(ch, 'ensureCoValueLoaded').mockImplementation(async () => osCore)
		spyOn(db, 'getSparkOsId').mockImplementation(async () => osId)
		spyOn(vh, 'hydrateValidationMetaFromPeer').mockImplementation(async () => {})
		const liSpy = spyOn(db, 'loadInfraFromSparkOs').mockImplementation(async (peer) => {
			peer.infra = { cobinary: 'co_zmock_cobinary' }
		})
		const peer = {
			systemSparkCoId: 'co_zspark1',
			getCurrentContent: (core) => (core === osCore ? makeFullOsContent() : null),
		}
		const { DataEngine } = await import('../src/data/index.js')
		const de = new DataEngine(peer, {})
		await Promise.all([de.resolveSystemFactories(), de.resolveSystemFactories()])
		expect(liSpy.mock.calls.length).toBe(1)
	})
})
