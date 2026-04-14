import {
	identityFromMaiaPath,
	maiaFactoryRefToNanoid,
} from '@MaiaOS/validation/identity-from-maia-path.js'
import { describe, expect, test } from 'bun:test'
import { buildSystemFactoryCoIdsFromSparkOs } from '../src/cojson/factory/system-factories-from-os.js'
import { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../src/cojson/spark-os-keys.js'

function mockPeer(graph) {
	const { getCoValue, getCurrentContent, isAvailable = () => true } = graph
	return {
		getCoValue,
		getCurrentContent,
		isAvailable,
		node: { getCoValue },
	}
}

describe('buildSystemFactoryCoIdsFromSparkOs', () => {
	test('returns empty Map for invalid os id', async () => {
		const peer = mockPeer({ getCoValue: () => null, getCurrentContent: () => null })
		expect((await buildSystemFactoryCoIdsFromSparkOs(peer, '')).size).toBe(0)
		expect((await buildSystemFactoryCoIdsFromSparkOs(peer, 'bad')).size).toBe(0)
	})

	test('builds nanoid map from definition catalog colist + meta anchor', async () => {
		const metaCoId = 'co_zMETA'
		const indexesMapId = 'co_zINDEXES'
		const catalogColistId = 'co_zCATALOG'
		const defId = 'co_zDEF'

		const osContent = {
			get(k) {
				if (k === SPARK_OS_META_FACTORY_CO_ID_KEY) return metaCoId
				if (k === 'indexes') return indexesMapId
			},
		}
		const indexesContent = {
			get(k) {
				if (k === metaCoId) return catalogColistId
			},
		}
		const catalogItems = [defId]
		const catalogColistContent = {
			toJSON: () => catalogItems,
		}
		const defContent = {
			get(k) {
				if (k === 'title') return '°maia/factory/event.factory.maia'
				return undefined
			},
		}

		const osCore = { id: 'co_zOS', isAvailable: () => true }
		const indexesCore = { id: indexesMapId, isAvailable: () => true }
		const catalogCore = {
			id: catalogColistId,
			isAvailable: () => true,
			getCurrentContent: () => catalogColistContent,
		}
		const defCore = { id: defId, isAvailable: () => true }

		const getCoValue = (id) => {
			if (id === 'co_zOS') return osCore
			if (id === indexesMapId) return indexesCore
			if (id === catalogColistId) return catalogCore
			if (id === defId) return defCore
			return null
		}
		const getCurrentContent = (core) => {
			if (core === osCore) return osContent
			if (core === indexesCore) return indexesContent
			if (core === catalogCore) return catalogColistContent
			if (core === defCore) return defContent
			return null
		}

		const peer = mockPeer({ getCoValue, getCurrentContent })
		const out = await buildSystemFactoryCoIdsFromSparkOs(peer, 'co_zOS')

		expect(out.get(maiaFactoryRefToNanoid('°maia/factory/event.factory.maia'))).toBe(defId)
		expect(out.get(identityFromMaiaPath('meta.factory.maia').$nanoid)).toBe(metaCoId)
	})
})
