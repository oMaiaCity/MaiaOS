import { describe, expect, test } from 'bun:test'

describe('peer.infra', () => {
	test('loadInfraFromSparkOs populates peer.infra from spark.os', async () => {
		const { loadInfraFromSparkOs } = await import('../src/modules/cojson-impl.js')

		const osContent = {
			get(k) {
				return `co_zslot_${k}`
			},
		}
		const osCore = { id: 'co_zos', isAvailable: () => true }
		const peer = {
			getCoValue: (id) => (id === 'co_zos' ? osCore : null),
			getCurrentContent: () => osContent,
			isAvailable: () => true,
		}
		await loadInfraFromSparkOs(peer, 'co_zos', { timeoutMs: 2000 })
		expect(peer.infra.meta).toBe('co_zslot_metaFactoryCoId')
		expect(peer.infra.capability).toBe('co_zslot_capabilityFactoryCoId')
	})
})
