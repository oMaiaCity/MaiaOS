/**
 * Namekey / bare registry resolution during seed, bootstrap, and helpers — uses
 * `spark.os.indexes["@nanoids"]` only. Not imported from the runtime public graph.
 */
import { FACTORY_REF_PATTERN, INSTANCE_REF_PATTERN, VIBE_REF_PATTERN } from '@MaiaOS/validation'
import { logicalRefToSeedNanoid } from '@MaiaOS/validation/identity-from-maia-path.js'
import { read as universalRead } from '../cojson/crud/read.js'
import { waitForStoreReady } from '../cojson/crud/read-operations.js'
import { resolve } from '../cojson/factory/authoring-resolver.js'
import { resolveSparkCoId } from '../cojson/groups/groups.js'
import { loadNanoidIndex } from '../cojson/indexing/factory-index-manager.js'

/**
 * @param {object} peer
 * @param {string} logicalRef
 * @returns {Promise<string|null>}
 */
async function coIdForRegistryRef(peer, logicalRef) {
	const nanoids = await loadNanoidIndex(peer)
	if (!nanoids || typeof nanoids.get !== 'function') return null
	let n
	try {
		n = logicalRef.startsWith('co_z')
			? null
			: logicalRef.startsWith('°') || logicalRef.startsWith('@')
				? logicalRefToSeedNanoid(logicalRef)
				: logicalRef
	} catch {
		return null
	}
	if (!n || typeof n !== 'string') return null
	const id = nanoids.get(n)
	return id?.startsWith?.('co_z') ? id : null
}

/**
 * Resolve registry namekeys (`°maia/factory/...`, vibes, instance keys) via `spark.os` and `@nanoids`.
 * @param {object} peer
 * @param {string} identifier
 * @param {{ returnType?: string, deepResolve?: boolean, timeoutMs?: number, spark?: string }} [options]
 */
export async function lookupRegistryKey(peer, identifier, options = {}) {
	const { returnType = 'factory', deepResolve = false, timeoutMs = 5000, spark } = options

	const isSchemaKeyMatch = FACTORY_REF_PATTERN.test(identifier)
	const isVibeKeyMatch = VIBE_REF_PATTERN.test(identifier)
	const isInstanceKeyMatch = INSTANCE_REF_PATTERN.test(identifier)
	const isBareKey =
		!identifier.startsWith('°') && !identifier.startsWith('@') && !identifier.startsWith('co_z')
	if (isSchemaKeyMatch || isVibeKeyMatch || isInstanceKeyMatch || isBareKey) {
		const effectiveSpark = spark ?? peer?.systemSparkCoId
		if (!effectiveSpark && (isSchemaKeyMatch || isVibeKeyMatch || isInstanceKeyMatch || isBareKey)) {
			throw new Error(
				`[lookupRegistryKey] spark required for ${identifier}. Pass options.spark or set peer.systemSparkCoId.`,
			)
		}
		let normalizedKey = identifier
		if (
			!FACTORY_REF_PATTERN.test(normalizedKey) &&
			!VIBE_REF_PATTERN.test(normalizedKey) &&
			!normalizedKey.startsWith('°') &&
			!normalizedKey.startsWith('@')
		) {
			normalizedKey = `${effectiveSpark}/schema/${normalizedKey}`
		}

		if (!peer.account || typeof peer.account.get !== 'function') {
			return null
		}

		const isSchemaKey = FACTORY_REF_PATTERN.test(normalizedKey)

		if (isSchemaKey) {
			const registryCoId =
				(await coIdForRegistryRef(peer, normalizedKey)) ?? (await coIdForRegistryRef(peer, identifier))
			if (registryCoId) {
				if (returnType === 'coId') {
					return registryCoId
				}
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			}
			return null
		} else if (VIBE_REF_PATTERN.test(identifier)) {
			const sparkCoId = await resolveSparkCoId(peer, effectiveSpark)
			if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) {
				return null
			}
			const sparkStore = await universalRead(peer, sparkCoId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(sparkStore, sparkCoId, timeoutMs)
			} catch {
				return null
			}
			const sparkData = sparkStore.value
			if (!sparkData || sparkData.error) return null
			const osId = sparkData.os
			if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) return null
			const osStore = await universalRead(peer, osId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(osStore, osId, timeoutMs)
			} catch {
				return null
			}
			const osData = osStore.value
			if (!osData || osData.error) return null
			const vibesId = osData.vibes
			if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_z')) {
				return null
			}

			const vibesStore = await universalRead(peer, vibesId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(vibesStore, vibesId, timeoutMs)
			} catch (_error) {
				return null
			}

			const vibesData = vibesStore.value
			if (!vibesData || vibesData.error) {
				return null
			}

			const vibeName = VIBE_REF_PATTERN.test(identifier)
				? identifier.replace(VIBE_REF_PATTERN, '')
				: identifier

			const registryCoId = vibesData[vibeName]
			if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
				if (returnType === 'coId') {
					return registryCoId
				}
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			}

			return null
		} else if (isInstanceKeyMatch) {
			const registryCoId =
				(await coIdForRegistryRef(peer, identifier)) ?? (await coIdForRegistryRef(peer, normalizedKey))
			if (registryCoId) {
				if (returnType === 'coId') {
					return registryCoId
				}
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			}
			return null
		}
	}

	return null
}
