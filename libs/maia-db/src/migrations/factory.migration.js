/**
 * Schema Migration - Identity layer for fresh accounts only.
 *
 * No legacy data migration. New accounts only.
 * Scaffold (registries, °maia spark, os) is created by bootstrap/seed.
 *
 * @param {RawAccount} account - The account (new or existing)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} [creationProps] - Creation properties (optional)
 * @returns {Promise<void>}
 */

import { createFactoryMeta } from '../factories/registry.js'

function travelerFallbackId(account) {
	const id =
		account?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '')
	const str = String(id || '')
	return (
		str.slice(-12) ||
		(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : '')
	)
}

export async function factoryMigration(account, node, creationProps) {
	const baseName = creationProps?.name?.trim()
	const profileName =
		baseName && baseName.length > 0 ? baseName : `Traveler ${travelerFallbackId(account)}`

	if (!account.get('profile')) {
		const profileMeta = createFactoryMeta('ProfileFactory')
		const profileGroup = node.createGroup()
		profileGroup.addMember('everyone', 'reader')
		const profileCoMap = profileGroup.createMap({ name: profileName }, profileMeta)
		account.set('profile', profileCoMap.id)
	}
}
