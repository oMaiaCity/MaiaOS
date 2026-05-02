/**
 * Append-only applied-migration log on spark.os (colist of step folder ids).
 */

import * as groups from '@MaiaOS/db'
import { createCoValueForSpark, ensureCoValueLoaded } from '@MaiaOS/db'
import { EXCEPTION_FACTORIES } from '@MaiaOS/db/registry'

const MAIA = '°maia'

export const APPLIED_MIGRATIONS_OS_KEY = 'appliedMigrations'

/**
 * @param {import('@MaiaOS/db').MaiaDB} peer
 * @returns {Promise<string[]>}
 */
export async function readAppliedMigrationIds(peer) {
	const osId = await groups.getSparkOsId(peer, MAIA)
	if (!osId?.startsWith?.('co_z')) return []

	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
	if (!osCore || !peer.isAvailable?.(osCore)) return []

	const os = peer.getCurrentContent(osCore)
	const colistCoId = os?.get?.(APPLIED_MIGRATIONS_OS_KEY)
	if (typeof colistCoId !== 'string' || !colistCoId.startsWith?.('co_z')) return []

	const colistCore = peer.node?.getCoValue?.(colistCoId)
	if (!colistCore || !peer.isAvailable?.(colistCore)) return []
	const items = colistCore.getCurrentContent?.()?.toJSON?.()
	if (!Array.isArray(items)) return []
	/** @type {string[]} */
	const out = []
	for (const it of items) {
		const s =
			typeof it === 'string'
				? it
				: typeof it === 'object' && it?.value !== undefined && typeof it.value === 'string'
					? it.value
					: null
		if (typeof s === 'string' && s.length > 0) out.push(s)
	}
	return out
}

/**
 * @param {import('@MaiaOS/db').MaiaDB} peer
 */
export async function hasAppliedMigration(peer, stepId) {
	const ids = await readAppliedMigrationIds(peer)
	return ids.includes(stepId)
}

/**
 * @param {{ peer: import('@MaiaOS/db').MaiaDB, account: import('cojson').RawAccount, node: import('cojson').LocalNode }} boot
 */
export async function ensureAppliedMigrationsColist(boot) {
	const { peer, account, node } = boot

	const maiaGroup = await groups.getMaiaGroup(peer)
	if (!maiaGroup) {
		throw new Error('[migrate/history] °maia group missing')
	}

	const osId = await groups.getSparkOsId(peer, MAIA)
	if (!osId?.startsWith?.('co_z')) {
		throw new Error('[migrate/history] spark.os missing')
	}

	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
	if (!osCore || !peer.isAvailable?.(osCore)) {
		throw new Error('[migrate/history] spark.os unavailable')
	}
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') {
		throw new Error('[migrate/history] invalid spark.os content')
	}

	let colistCoId = osContent.get(APPLIED_MIGRATIONS_OS_KEY)
	if (typeof colistCoId === 'string' && colistCoId.startsWith?.('co_z')) {
		return colistCoId
	}

	const { coValue: colist } = await createCoValueForSpark(
		{ node, account, guardian: maiaGroup },
		null,
		{
			factory: EXCEPTION_FACTORIES.META_SCHEMA,
			cotype: 'colist',
			data: [],
			dataEngine: peer.dbEngine,
		},
	)
	colistCoId = colist.id
	osContent.set(APPLIED_MIGRATIONS_OS_KEY, colistCoId)

	if (peer.node?.storage?.syncManager?.waitForStorageSync) {
		try {
			await peer.node.syncManager.waitForStorageSync(colistCoId)
			await peer.node.syncManager.waitForStorageSync(osId)
		} catch (_e) {}
	}

	return colistCoId
}

/**
 * @param {{ peer: import('@MaiaOS/db').MaiaDB, account: import('cojson').RawAccount, node: import('cojson').LocalNode }} boot
 * @param {string} stepId — folder id, e.g. `001-genesis`
 */
export async function appendAppliedMigration(boot, stepId) {
	if (typeof stepId !== 'string' || stepId.trim().length === 0) {
		throw new Error('[migrate/history] invalid stepId')
	}
	const existing = await readAppliedMigrationIds(boot.peer)
	if (existing.includes(stepId)) {
		return
	}

	await ensureAppliedMigrationsColist(boot)

	const osId = await groups.getSparkOsId(boot.peer, MAIA)
	if (!osId?.startsWith?.('co_z')) {
		throw new Error('[migrate/history] spark.os missing for append')
	}
	const osCore = await ensureCoValueLoaded(boot.peer, osId, { waitForAvailable: true })
	const osContent = boot.peer.getCurrentContent(osCore)
	const colistCoId = osContent?.get?.(APPLIED_MIGRATIONS_OS_KEY)
	if (typeof colistCoId !== 'string' || !colistCoId.startsWith?.('co_z')) {
		throw new Error('[migrate/history] applied migrations colist missing')
	}

	const colistCore = boot.peer.node?.getCoValue?.(colistCoId)
	if (!colistCore || !boot.peer.isAvailable?.(colistCore)) {
		throw new Error('[migrate/history] applied migrations colist unavailable')
	}
	const colist = colistCore.getCurrentContent?.()
	if (!colist || typeof colist.append !== 'function') {
		throw new Error('[migrate/history] invalid applied migrations content')
	}
	colist.append(stepId)

	if (boot.peer.node?.storage?.syncManager?.waitForStorageSync) {
		try {
			await boot.peer.node.syncManager.waitForStorageSync(colistCoId)
		} catch (_e) {}
	}
}
