/**
 * Build factory $nanoid → factory co_z from spark.os using live CoMap APIs (same source as seed collectSparkOsRegistry).
 * Reactive read() snapshots are not used here — they can omit indexes/catalog keys before deep resolve.
 */

import { namekeyFromFactoryDefinitionContent } from '@MaiaOS/factories'
import {
	identityFromMaiaPath,
	maiaFactoryRefToNanoid,
} from '@MaiaOS/factories/identity-from-maia-path.js'
import { ensureCoValueLoaded } from '../crud/collection-helpers.js'
import { INFRA_FACTORY_NANOID_BY_ROLE, RUNTIME_REF } from '../factory/runtime-factory-refs.js'
import { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../spark-os-keys.js'

const OS_CAPABILITY_NANOID = INFRA_FACTORY_NANOID_BY_ROLE[RUNTIME_REF.OS_CAPABILITY]

/**
 * Seeded catalogs before the canonical factory title used a plain "Capability" label,
 * so {@link namekeyFromFactoryDefinitionContent} returned null and OS_CAPABILITY never
 * entered {@link peer.systemFactoryCoIds}. Match that legacy shape only.
 * @param {object} defContent - CoMap content from a definition CoValue
 * @returns {boolean}
 */
function isLegacyCapabilityFactoryDefinition(defContent) {
	if (!defContent || typeof defContent.get !== 'function') return false
	const get = (k) => defContent.get(k)
	if (get('cotype') !== 'comap' || get('indexing') !== true) return false
	const req = get('required')
	if (!Array.isArray(req)) return false
	const need = new Set(['sub', 'cmd', 'pol', 'exp'])
	for (const k of req) need.delete(k)
	return need.size === 0
}

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
							let namekey = namekeyFromFactoryDefinitionContent(defContent)
							if (!namekey && OS_CAPABILITY_NANOID && isLegacyCapabilityFactoryDefinition(defContent)) {
								namekey = '°maia/factory/capability.factory.maia'
							}
							const n = namekey ? maiaFactoryRefToNanoid(namekey) : null
							if (n) out.set(n, defCoId)
						}
					}
				}
			}
		}
	}

	if (metaCoId?.startsWith?.('co_z')) {
		out.set(identityFromMaiaPath('meta.factory.maia').$nanoid, metaCoId)
	}

	return out
}
