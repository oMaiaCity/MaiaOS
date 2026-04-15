/**
 * Account scaffold: profile (public) + root metaschema (private).
 * @param {import('cojson').RawAccount} account
 * @param {import('cojson').LocalNode} node
 * @param {Object} [creationProps]
 */
function travelerFallbackId(account) {
	const id =
		account?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '')
	const str = String(id || '')
	return (
		str.slice(-12) ||
		(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : '')
	)
}

export async function ensureAccountScaffold(account, node, creationProps) {
	const baseName = creationProps?.name?.trim()
	const profileName =
		baseName && baseName.length > 0 ? baseName : `Traveler ${travelerFallbackId(account)}`

	if (!account.get('profile')) {
		const profileMeta = { $factory: 'ProfileSchema' }
		const profileGroup = node.createGroup()
		profileGroup.addMember('everyone', 'reader')
		const profileCoMap = profileGroup.createMap({ name: profileName }, profileMeta)
		account.set('profile', profileCoMap.id)
	}

	if (!account.get('root')) {
		const rootGroup = node.createGroup()
		const rootMeta = { $factory: 'MetaSchema' }
		const rootCoMap = rootGroup.createMap({}, rootMeta)
		account.set('root', rootCoMap.id)
	}
}
