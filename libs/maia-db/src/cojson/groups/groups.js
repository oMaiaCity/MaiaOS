/**
 * Group Operations — peer.read / OS-spark resolution (core extractors in groups-core.js).
 */

import { ensureCoValueLoaded } from '../crud/ensure-covalue-core.js'
import { waitForStoreReady } from '../crud/read-operations.js'
import { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../spark-os-keys.js'
import { readCoMapCoIdField, readLiveSparksRegistryEntries } from './groups-core.js'

export {
	extractAccountMembers,
	extractEveryoneRole,
	extractGroupMembers,
	getGroup,
	getGroupInfoFromGroup,
	removeGroupMember,
	wouldLeaveNoAdmins,
} from './groups-core.js'

/**
 * Get capability group co-id from os CoMap id (os -> groups -> capabilityName)
 * Uses read() + waitForStoreReady to ensure os/groups are synced (e.g. when agent
 * loads human's spark via sync - os and groups must be fetched before access).
 * @param {Object} peer - Backend instance
 * @param {string} osId - OS CoMap co-id
 * @param {string} capabilityName - Group key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
export async function getCapabilityGroupIdFromOsId(peer, osId, capabilityName) {
	if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) return null
	const osStore = await peer.read(null, osId)
	await waitForStoreReady(osStore, osId, 15000)
	const osCore = peer.getCoValue(osId)
	if (!osCore || !peer.isAvailable(osCore)) return null
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') return null
	let groupsId = osContent.get('groups')
	if (!groupsId?.startsWith('co_z')) {
		groupsId = readCoMapCoIdField(peer, osId, 'groups')
	}
	if (!groupsId || typeof groupsId !== 'string' || !groupsId.startsWith('co_z')) return null
	const groupsStore = await peer.read(null, groupsId)
	await waitForStoreReady(groupsStore, groupsId, 15000)
	const groupsCore = peer.getCoValue(groupsId)
	if (!groupsCore || !peer.isAvailable(groupsCore)) return null
	const groupsContent = peer.getCurrentContent(groupsCore)
	if (!groupsContent || typeof groupsContent.get !== 'function') return null
	let groupId = groupsContent.get(capabilityName)
	if (!groupId?.startsWith('co_z')) {
		groupId = readCoMapCoIdField(peer, groupsId, capabilityName)
	}
	if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) return null
	return groupId
}

export async function getSparkCapabilityGroupId(peer, spark, capabilityName) {
	const osId = await getSparkOsId(peer, spark)
	return getCapabilityGroupIdFromOsId(peer, osId, capabilityName)
}

/**
 * Get capability group co-id for a spark by spark co-id (not spark name)
 * @param {Object} peer - Backend instance
 * @param {string} sparkCoId - Spark CoMap co-id
 * @param {string} capabilityName - Capability key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
export async function getSparkCapabilityGroupIdFromSparkCoId(peer, sparkCoId, capabilityName) {
	if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) return null
	const sparkCore = peer.getCoValue(sparkCoId) || (await peer.node?.loadCoValueCore?.(sparkCoId))
	if (!sparkCore || !peer.isAvailable?.(sparkCore)) return null
	const sparkContent = peer.getCurrentContent?.(sparkCore)
	if (!sparkContent || typeof sparkContent.get !== 'function') return null
	const osId = sparkContent.get('os')
	return getCapabilityGroupIdFromOsId(peer, osId, capabilityName)
}

/**
 * Get guardian (admin-role) group for a spark by name
 * Resolves from spark.os.groups.guardian only (no spark.group; fresh DB).
 * @param {Object} peer - Backend instance with read(), getCoValue(), getCurrentContent(), account
 * @param {string} spark - Spark name (e.g. "°maia", "@handle")
 * @returns {Promise<RawGroup|null>} Group for the spark or null
 */
export async function getSparkGroup(peer, spark) {
	if (!spark || typeof spark !== 'string') {
		throw new Error('[getSparkGroup] spark is required')
	}
	const cacheKey = `_cachedSparkGroup_${spark}`
	if (peer[cacheKey]) {
		return peer[cacheKey]
	}
	const groupId = await getSparkCapabilityGroupId(peer, spark, 'guardian')
	if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) {
		throw new Error(`[getSparkGroup] Spark ${spark} has no guardian in os.groups`)
	}
	const groupStore = await peer.read('@group', groupId)
	if (!groupStore || groupStore.value?.error) {
		throw new Error(`[getSparkGroup] Group for spark ${spark} not available: ${groupId}`)
	}
	await waitForStoreReady(groupStore, groupId, 10000)
	const groupCore = peer.getCoValue(groupId)
	if (!groupCore) {
		throw new Error(`[getSparkGroup] Group core not found: ${groupId}`)
	}
	const group = peer.getCurrentContent(groupCore)
	if (!group || typeof group.createMap !== 'function') {
		throw new Error(`[getSparkGroup] Group content not available: ${groupId}`)
	}
	peer[cacheKey] = group
	return group
}

/** Get sparks registry CoMap co-id (top-level account.sparks). Returns null if not found. */
export async function getSparksRegistryId(peer) {
	const sparksId = peer.account?.get?.('sparks')
	if (!sparksId?.startsWith('co_z')) return null
	return sparksId
}

export async function getSparksRegistryContent(peer) {
	const sparksId = await getSparksRegistryId(peer)
	if (!sparksId?.startsWith('co_z')) return null
	const sparksStore = await peer.read(null, sparksId)
	await waitForStoreReady(sparksStore, sparksId, 10000)
	const fromStore = sparksStore?.value ?? {}
	const live = readLiveSparksRegistryEntries(peer, sparksId)
	const merged = { ...fromStore, ...live }
	return {
		get(key) {
			const v = merged[key]
			return typeof v === 'string' && v.startsWith('co_z') ? v : undefined
		},
	}
}

/** Resolve spark key to spark co-id (from registries or use co-id directly). */
export async function resolveSparkCoId(peer, spark) {
	if (!spark || typeof spark !== 'string') return null
	if (spark.startsWith('co_z')) return spark
	const sparks = await getSparksRegistryContent(peer)
	if (!sparks) return null
	return sparks.get(spark) ?? null
}

/**
 * Seeded metafactory co-id from spark.os.metaFactoryCoId (single anchor for factory-definition headers).
 * @param {Object} peer
 * @param {string} [spark]
 * @returns {Promise<string|null>}
 */
export async function getSparkOsMetaFactoryCoId(peer, spark) {
	const effectiveSpark = spark ?? peer?.systemSparkCoId ?? '°maia'
	const osId = await getSparkOsId(peer, effectiveSpark)
	if (!osId?.startsWith('co_z')) return null
	if (peer.node?.loadCoValueCore) {
		await peer.node.loadCoValueCore(osId).catch(() => {})
	}
	const osCore = peer.getCoValue?.(osId) ?? peer.node?.getCoValue?.(osId)
	if (!osCore?.isAvailable?.()) return null
	const osContent = peer.getCurrentContent?.(osCore) ?? osCore.getCurrentContent?.()
	if (!osContent || typeof osContent.get !== 'function') return null
	const coId = osContent.get(SPARK_OS_META_FACTORY_CO_ID_KEY)
	return typeof coId === 'string' && coId.startsWith('co_z') ? coId : null
}

export async function getSparkOsId(peer, spark) {
	const sparkCoId = await resolveSparkCoId(peer, spark)
	if (!sparkCoId?.startsWith('co_z')) return null
	const sparkStore = await peer.read(null, sparkCoId)
	await waitForStoreReady(sparkStore, sparkCoId, 10000)
	const sparkData = sparkStore?.value ?? {}
	let osId = sparkData.os || null
	if (!osId?.startsWith('co_z')) {
		osId = readCoMapCoIdField(peer, sparkCoId, 'os')
	}
	if (osId) peer._cachedMaiaOsId = osId
	return osId
}

/**
 * Get spark's vibes CoMap id (account.sparks[spark].os.vibes)
 * @param {Object} peer
 * @param {string} spark
 * @returns {Promise<string|null>}
 */
export async function getSparkVibesId(peer, spark) {
	const osId = await getSparkOsId(peer, spark)
	if (!osId?.startsWith('co_z')) return null
	const osStore = await peer.read(null, osId)
	await waitForStoreReady(osStore, osId, 10000)
	const osData = osStore?.value ?? {}
	let vibesId = osData.vibes ?? null
	if (!vibesId?.startsWith('co_z')) {
		vibesId = readCoMapCoIdField(peer, osId, 'vibes')
	}
	return vibesId
}

/**
 * Set spark's vibes CoMap id (spark.os.vibes)
 * @param {Object} peer
 * @param {string} spark
 * @param {string} vibesId
 */
export async function setSparkVibesId(peer, spark, vibesId) {
	const osId = await getSparkOsId(peer, spark)
	if (!osId?.startsWith('co_z')) throw new Error(`[setSparkVibesId] Spark ${spark} has no os`)
	const osStore = await peer.read(null, osId)
	await waitForStoreReady(osStore, osId, 10000)
	const osCore = peer.getCoValue(osId)
	if (!osCore || !peer.isAvailable(osCore))
		throw new Error(`[setSparkVibesId] OS not available: ${osId}`)
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.set !== 'function')
		throw new Error(`[setSparkVibesId] OS content not available`)
	osContent.set('vibes', vibesId)
}

/**
 * Get °maia spark's group (for create operations, seeding, etc.)
 * @param {Object} peer - Backend instance
 * @returns {Promise<RawGroup|null>} °maia spark's group
 */
export async function getMaiaGroup(peer) {
	return getSparkGroup(peer, '°maia')
}

/**
 * Add a member to a group. Accepts account co-id only; agent ID is resolved internally (never exposed).
 * Sealer/signer and PEER_SECRET are private - never accept, log, or expose agent IDs.
 * Stores account co-id (co_z) as the group member key so resolveAccountCoIdsToProfiles works.
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} accountCoId - Account co-id (co_z...) - REQUIRED
 * @param {string} role - Role name
 * @param {Object} [peer] - Optional peer (for ensureCoValueLoaded)
 * @returns {Promise<void>}
 */
export async function addGroupMember(node, group, accountCoId, role, peer = null) {
	if (typeof group.addMember !== 'function') {
		throw new Error('[MaiaDB] Group does not support addMember')
	}

	if (!accountCoId?.startsWith('co_z')) {
		throw new Error(
			'[MaiaDB] accountCoId required (co_z...). Human must sign in from maia first so account syncs.',
		)
	}

	if (peer) {
		await ensureCoValueLoaded(peer, accountCoId, { waitForAvailable: true, timeoutMs: 10000 })
	}
	const accountCore = node.expectCoValueLoaded(
		accountCoId,
		'Expected account loaded. Human must sign in from maia at least once so account syncs.',
	)
	const accountContent = accountCore.getCurrentContent()
	// Resolve to agent ID internally only - never expose, log, or accept agent ID as input
	let agentId = null
	if (typeof accountContent?.currentAgentID === 'function') {
		agentId = accountContent.currentAgentID()
	} else if (accountCore.verified?.header?.ruleset?.type === 'group') {
		const raw = accountCore.verified.header.ruleset.initialAdmin
		if (typeof raw === 'string' && raw.startsWith('sealer_') && raw.includes('/signer_')) {
			agentId = raw
		}
	}
	if (!agentId) {
		throw new Error(
			'[addGroupMember] Could not resolve agent ID from account. Human must sign in from maia at least once.',
		)
	}
	// Pass account-like object so CoJSON stores account co-id (co_z), not agent ID (sealer_z)
	const accountLike = { id: accountCoId, currentAgentID: () => agentId }
	group.addMember(accountLike, role)
}

/**
 * Set a member's role in a group
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID
 * @param {string} role - New role name
 * @returns {Promise<void>}
 */
export async function setGroupMemberRole(node, group, memberId, role) {
	if (typeof group.setRole === 'function') {
		group.setRole(memberId, role)
	} else if (typeof group.removeMember === 'function' && typeof group.addMember === 'function') {
		group.removeMember(memberId)
		await addGroupMember(node, group, memberId, role, null)
	} else {
		throw new Error('[MaiaDB] Group does not support role changes')
	}
}
