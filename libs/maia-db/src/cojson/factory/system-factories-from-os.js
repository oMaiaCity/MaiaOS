/**
 * Build namekey → factory co_z from spark.os using live CoMap APIs (same source as seed collectSparkOsRegistry).
 * Reactive read() snapshots are not used here — they can omit indexes/catalog keys before deep resolve.
 */

import { FACTORY_REF_PATTERN } from '@MaiaOS/factories'
import { ensureCoValueLoaded } from '../crud/collection-helpers.js'
import { SPARK_OS_INSTANCES_KEY, SPARK_OS_META_FACTORY_CO_ID_KEY } from '../spark-os-keys.js'

const RESERVED_INSTANCE_KEYS = new Set([
	'id',
	'loading',
	'error',
	'$factory',
	'type',
	'_coValueType',
])

/**
 * @param {object} peer — MaiaDB (node + account + getCoValue / getCurrentContent / isAvailable)
 * @param {string} osId — spark.os CoMap co_z
 * @returns {Promise<Map<string, string>>}
 */
export async function buildSystemFactoryCoIdsFromSparkOs(peer, osId) {
	const out = new Map()
	if (!osId?.startsWith?.('co_z')) return out

	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
	if (!osCore || !peer.isAvailable(osCore)) return out
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') return out

	const metaCoId = osContent.get(SPARK_OS_META_FACTORY_CO_ID_KEY)
	const indexesId = osContent.get('indexes')

	if (metaCoId?.startsWith?.('co_z') && indexesId?.startsWith?.('co_z')) {
		const indexesCore = await ensureCoValueLoaded(peer, indexesId, { waitForAvailable: true })
		if (indexesCore && peer.isAvailable(indexesCore)) {
			const indexesContent = peer.getCurrentContent(indexesCore)
			const catalogColistId = indexesContent?.get?.(metaCoId)
			if (catalogColistId?.startsWith?.('co_z')) {
				const colistCore = peer.getCoValue(catalogColistId)
				if (colistCore && peer.isAvailable(colistCore)) {
					const colistContent = colistCore.getCurrentContent?.()
					const items = colistContent?.toJSON?.() ?? []
					if (Array.isArray(items)) {
						for (const defCoId of items) {
							if (typeof defCoId !== 'string' || !defCoId.startsWith('co_z')) continue
							await ensureCoValueLoaded(peer, defCoId, { waitForAvailable: true })
							const defCore = peer.getCoValue(defCoId)
							if (!defCore || !peer.isAvailable(defCore)) continue
							const defContent = peer.getCurrentContent(defCore)
							const title = defContent?.get?.('title')
							const idKey = defContent?.get?.('$id')
							const namekey =
								typeof title === 'string' && FACTORY_REF_PATTERN.test(title)
									? title
									: typeof idKey === 'string' && FACTORY_REF_PATTERN.test(idKey)
										? idKey
										: null
							if (namekey) out.set(namekey, defCoId)
						}
					}
				}
			}
		}
	}

	if (metaCoId?.startsWith?.('co_z')) {
		out.set('°maia/factory/meta', metaCoId)
	}

	const instancesId = osContent.get(SPARK_OS_INSTANCES_KEY)
	if (instancesId?.startsWith?.('co_z')) {
		const instCore = await ensureCoValueLoaded(peer, instancesId, { waitForAvailable: true })
		if (instCore && peer.isAvailable(instCore)) {
			const instContent = peer.getCurrentContent(instCore)
			const keys =
				instContent?.keys && typeof instContent.keys === 'function'
					? Array.from(instContent.keys())
					: Object.keys(instContent ?? {})
			for (const key of keys) {
				if (RESERVED_INSTANCE_KEYS.has(key)) continue
				const coId = instContent.get(key)
				if (typeof key === 'string' && typeof coId === 'string' && coId.startsWith('co_z')) {
					out.set(key, coId)
				}
			}
		}
	}

	return out
}
