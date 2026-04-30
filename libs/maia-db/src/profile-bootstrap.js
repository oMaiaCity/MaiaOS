/**
 * Profile bootstrap for new accounts (identity layer).
 * Not config migration — creates Profile CoMap when missing.
 *
 * @param {import('cojson').RawAccount} account - The account (new or existing)
 * @param {import('cojson').LocalNode} node - The LocalNode instance
 * @param {Object} [creationProps] - Creation properties (optional)
 * @returns {Promise<void>}
 */

import { createFactoryMeta } from '@MaiaOS/validation/peer-factory-registry'

function travelerFallbackId(account) {
	const id =
		account?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '')
	const str = String(id || '')
	return (
		str.slice(-12) ||
		(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : '')
	)
}

export async function ensureProfileForNewAccount(account, node, creationProps) {
	const baseName = creationProps?.name?.trim()
	const profileName =
		baseName && baseName.length > 0 ? baseName : `Traveler ${travelerFallbackId(account)}`

	if (!account.get('profile')) {
		const profileMeta = createFactoryMeta('ProfileFactory')
		const profileGroup = node.createGroup()
		profileGroup.addMember('everyone', 'reader')
		const profileCoMap = profileGroup.createMap({ name: profileName }, profileMeta)
		// 'trusting' (public): CoJSON's own validation reads `profile` before any migration runs
		// and fresh browsers can't decrypt private fields before the owning group's readKey has synced.
		// Profile points at a CoMap whose own group controls visibility; the pointer itself must be public.
		account.set('profile', profileCoMap.id, 'trusting')
	}
}
