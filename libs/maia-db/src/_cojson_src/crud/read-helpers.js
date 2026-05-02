import { createLogger } from '@MaiaOS/logs'
import { maiaIdentity } from '@MaiaOS/validation'

import { INFRA_SLOTS } from '../infra-slot-manifest.js'
import { waitForStoreReady } from './read-operations.js'

export const log = createLogger('maia-db')

export async function resolveSchemaLazy(peer, identifier, options) {
	const { resolve } = await import('../factory/authoring-resolver.js')
	return resolve(peer, identifier, options)
}

export function debugLog(...args) {
	if (typeof process !== 'undefined' && process.env?.DEBUG) log.debug(...args)
}

/**
 * Shared cleanup for single CoValue subscriptions: origUnsub, coUnsub, depUnsubs, observer hub.
 * Evicts readStore cache entry so a dead unified store is never returned again.
 */
export function makeSingleCoCleanup(
	peer,
	coId,
	coUnsub,
	depUnsubs,
	origUnsub,
	extra = null,
	readStoreCacheKey = null,
	storeToMarkDead = null,
) {
	return () => {
		if (origUnsub) origUnsub()
		if (extra) extra()
		coUnsub()
		for (const u of depUnsubs.values()) u()
		depUnsubs.clear()
		peer.subscriptionCache.scheduleCleanup(`observer:${coId}`)
		if (readStoreCacheKey) peer.subscriptionCache.evict(readStoreCacheKey)
		if (storeToMarkDead) storeToMarkDead._maiaReadReactiveDead = true
	}
}

/** Detect findOne pattern: filter with single id field pointing to co-id */
export function isFindOneFilter(filter) {
	return (
		filter &&
		typeof filter === 'object' &&
		Object.keys(filter).length === 1 &&
		filter.id &&
		typeof filter.id === 'string' &&
		filter.id.startsWith('co_z')
	)
}

/**
 * True if value looks like a context query object (has factory for reads), not a DB_OP payload.
 * DB_OP payloads have { op, factory, data } - factory is operation target, not a read query.
 */
export function isQueryObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value) || !value.factory) return false
	if (value.op && !['query', 'read'].includes(value.op) && typeof value.factory === 'string')
		return false
	return true
}

/** Query filter lives under `options.filter` (context.factory.json). */
export function getQueryFilterFromValue(value) {
	return value?.options?.filter ?? null
}

export function getQueryMapFromValue(value) {
	return value?.options?.map ?? null
}

/**
 * One lifecycle bag per cached derived ReactiveStore (collection, allCoValues, registry readers).
 * Replaces scattered _maiaRead* flags.
 */
export function ensureDerivedLifecycle(store) {
	if (!store._lifecycle) {
		store._lifecycle = {
			live: false,
			unsubscribeHooked: false,
			baseUnsubscribe: undefined,
			runState: { running: false, queued: false },
			collectionSubscribedItemIds: new Set(),
			collectionSubscribedResolvedRefKeys: new Set(),
			collectionSharedVisited: new Set(),
			allCoValuesSubscribedIds: new Set(),
			registryReaderWired: false,
		}
	}
	return store._lifecycle
}

export function setMaiaReadDerivedStoreLive(store, live) {
	ensureDerivedLifecycle(store).live = live
}

/**
 * Extract co-ids from raw item that map expressions depend on.
 * Supports $path and $$path: both mean resolve from current item.
 * If item[rootProperty] is a co-id string, we must subscribe to it for reactivity.
 * @param {Object} rawData - Raw CoValue data (before map, may have co-id refs)
 * @param {Object} mapConfig - Map config e.g. { members: "$group.accountMembers", content: "$content" }
 * @returns {Set<string>} Co-ids that affect the mapped result
 */
export function getMapDependencyCoIds(rawData, mapConfig) {
	if (!mapConfig || typeof mapConfig !== 'object' || !rawData || typeof rawData !== 'object') {
		return new Set()
	}
	const deps = new Set()
	for (const expression of Object.values(mapConfig)) {
		if (typeof expression !== 'string') continue
		// Skip wildcard
		if (expression === '*') continue
		const path = expression.startsWith('$$')
			? expression.substring(2)
			: expression.startsWith('$')
				? expression.substring(1)
				: null
		if (!path) continue // pass-through, no resolution dependency
		const rootProperty = path.split('.')[0]
		if (rootProperty && rootProperty in rawData) {
			const val = rawData[rootProperty]
			if (typeof val === 'string' && val.startsWith('co_z')) {
				deps.add(val)
			}
		}
	}
	return deps
}

/** Leaf basename `identity.factory.json` from meta-schema title `°maia/factory/identity.factory.json`. */
function factoryBasenameFromSchemaTitle(title) {
	if (typeof title !== 'string') return null
	const leaf = title.includes('/') ? title.split('/').pop() : title.trim()
	return leaf?.endsWith('.factory.json') ? leaf : null
}

/**
 * Actor contexts persist factory schema co-ids from seed/bootstrap. After a fresh scaffold or registry
 * churn, those ids can diverge from spark.os infra slots. Bootstrap persists factory **definition**
 * bodies **without** `$nanoid` (only `title`, properties, …), so alignment uses `title` → basename and
 * matches {@link INFRA_SLOTS}. Optional `$nanoid` fallback covers older rows.
 *
 * Rewiring queries to `peer.infra.*` restores index lookup and spark registry reads
 * (`resolvedSchema === peer.infra.dataSpark`).
 *
 * @param {Object} peer - MaiaDB-like peer with `.infra`
 * @param {string} factoryCoId - Resolved schema co-id (`co_z…`)
 * @param {Function} universalRead - Same contract as universal read(peer, …)
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
export async function alignQueryFactoryCoIdWithSparkOsInfra(
	peer,
	factoryCoId,
	universalRead,
	timeoutMs = 5000,
) {
	if (!factoryCoId?.startsWith?.('co_z') || !peer?.infra || typeof universalRead !== 'function') {
		return factoryCoId
	}

	for (const { infraKey } of INFRA_SLOTS) {
		const canonical = peer.infra[infraKey]
		if (canonical?.startsWith?.('co_z') && factoryCoId === canonical) return factoryCoId
	}

	let slotBasename = null
	try {
		const store = await universalRead(peer, factoryCoId, null, null, {
			deepResolve: false,
			timeoutMs,
		})
		await waitForStoreReady(store, factoryCoId, Math.min(timeoutMs, 3000))
		const data = store?.value
		slotBasename = factoryBasenameFromSchemaTitle(data?.title)
		if (!slotBasename && typeof data?.$nanoid === 'string' && data.$nanoid.length > 0) {
			for (const { basename } of INFRA_SLOTS) {
				if (data.$nanoid === maiaIdentity(basename).$nanoid) {
					slotBasename = basename
					break
				}
			}
		}
	} catch {
		return factoryCoId
	}

	if (!slotBasename) return factoryCoId

	const slot = INFRA_SLOTS.find((s) => s.basename === slotBasename)
	const canonical = slot ? peer.infra[slot.infraKey] : null
	if (canonical?.startsWith?.('co_z') && factoryCoId !== canonical) return canonical
	return factoryCoId
}
