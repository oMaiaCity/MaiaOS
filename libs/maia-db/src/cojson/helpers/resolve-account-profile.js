/**
 * Resolve account co-ids to their profile names
 * Used by maia-db and other UIs to display human-readable names instead of opaque co-ids
 */

/**
 * Wait for a reactive store to finish loading (if loading)
 * @param {Object} store - Store with .loading and .subscribe()
 * @param {number} timeoutMs - Timeout in ms
 */
async function waitForStore(store, timeoutMs = 5000) {
	const val = store?.value ?? store
	if (!val?.loading) return
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Timeout waiting for store')), timeoutMs)
		const unsubscribe = store.subscribe?.((v) => {
			const s = v ?? store?.value ?? store
			if (!s?.loading) {
				clearTimeout(timeout)
				unsubscribe?.()
				resolve()
			}
		})
		const current = store?.value ?? store
		if (!current?.loading) {
			clearTimeout(timeout)
			unsubscribe?.()
			resolve()
		}
	})
}

/**
 * Fallback when profile has no name: "Traveler " + short id (last 12 chars of account co-id)
 */
function travelerFallback(accountCoId) {
	const shortId = typeof accountCoId === 'string' ? accountCoId.slice(-12) : ''
	return `Traveler ${shortId}`
}

/**
 * Resolve account co-id to profile co-id via humans registry (public lookup)
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @param {string} accountCoId - Account co-id (co_z...)
 * @returns {Promise<string|null>} Profile co-id or null if not found
 */
async function resolveAccountToProfileCoIdViaHumans(maia, accountCoId) {
	try {
		const registriesId = maia?.id?.maiaId?.get?.('registries')
		if (!registriesId?.startsWith('co_z')) return null
		const registriesStore = await maia.do({ op: 'read', schema: null, key: registriesId })
		await waitForStore(registriesStore, 5000)
		const registriesData = registriesStore?.value ?? registriesStore
		if (!registriesData?.humans?.startsWith('co_z')) return null
		const humansStore = await maia.do({ op: 'read', schema: null, key: registriesData.humans })
		await waitForStore(humansStore, 5000)
		const humansData = humansStore?.value ?? humansStore
		const humanCoId = humansData?.[accountCoId]
		if (!humanCoId?.startsWith('co_z')) return null
		const humanStore = await maia.do({ op: 'read', schema: null, key: humanCoId })
		await waitForStore(humanStore, 5000)
		const humanData = humanStore?.value ?? humanStore
		const profileCoId = humanData?.profile
		return profileCoId?.startsWith('co_z') ? profileCoId : null
	} catch (_e) {
		return null
	}
}

/**
 * Resolve a single account co-id to its profile name
 * Uses humans registry (public) first; falls back to account read for self.
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @param {string} accountCoId - Account co-id (co_z...)
 * @returns {Promise<string|null>} Profile co-id or null if not found
 */
async function resolveAccountToProfileCoIdViaHumans(maia, accountCoId) {
	try {
		let profileCoId = await resolveAccountToProfileCoIdViaHumans(maia, accountCoId)
		if (!profileCoId) {
			const accountStore = await maia.do({ op: 'read', schema: '@account', key: accountCoId })
			await waitForStore(accountStore, 5000)
			const accountData = accountStore?.value ?? accountStore
			profileCoId = accountData?.profile?.startsWith('co_') ? accountData.profile : null
		}
		if (!profileCoId) return travelerFallback(accountCoId)
		const profileStore = await maia.do({ op: 'read', schema: null, key: profileCoId })
		await waitForStore(profileStore, 5000)
		const profileData = profileStore?.value ?? profileStore
		const name = profileData?.name
		return typeof name === 'string' && name.length > 0 ? name : travelerFallback(accountCoId)
	} catch (_e) {
		return null
	}
}

/**
 * Resolve account co-ids to their profile names
 * @param {Object} maia - MaiaOS instance with maia.do() (operations API)
 * @param {string[]} accountCoIds - Array of account co-ids (co_z...); skips 'everyone' and non-co_z
 * @returns {Promise<Map<string, string>>} Map of accountCoId → profile name (or "Traveler " + short id when empty)
 */
async function resolveAccountToProfileCoIdViaAvens(maia, accountCoId) {
	try {
		const registriesId = maia?.id?.maiaId?.get?.('registries')
		if (!registriesId?.startsWith('co_z')) return null
		const registriesStore = await maia.do({ op: 'read', schema: null, key: registriesId })
		await waitForStore(registriesStore, 5000)
		const registriesData = registriesStore?.value ?? registriesStore
		if (!registriesData?.avens?.startsWith('co_z')) return null
		const avensStore = await maia.do({ op: 'read', schema: null, key: registriesData.avens })
		await waitForStore(avensStore, 5000)
		const avensData = avensStore?.value ?? avensStore
		const avenIdentityCoId = avensData?.[accountCoId]
		if (!avenIdentityCoId?.startsWith('co_z')) return null
		const avenIdentityStore = await maia.do({ op: 'read', schema: null, key: avenIdentityCoId })
		await waitForStore(avenIdentityStore, 5000)
		const avenIdentityData = avenIdentityStore?.value ?? avenIdentityStore
		const profileCoId = avenIdentityData?.profile
		return profileCoId?.startsWith('co_z') ? profileCoId : null
	} catch (_e) {
		return null
	}
}

/**
 * Resolve a single account co-id to profile id, name, and image
 * Uses humans registry (public) first; falls back to account read for self.
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @param {string} accountCoId - Account co-id (co_z...)
 * @returns {Promise<{ id: string|null, name: string, image: string|null }>}
 */
async function resolveOneToProfile(maia, accountCoId) {
	try {
		let profileCoId = await resolveAccountToProfileCoIdViaHumans(maia, accountCoId)
		if (!profileCoId) {
			profileCoId = await resolveAccountToProfileCoIdViaAvens(maia, accountCoId)
		}
		if (!profileCoId) {
			const accountStore = await maia.do({ op: 'read', schema: '@account', key: accountCoId })
			await waitForStore(accountStore, 5000)
			const accountData = accountStore?.value ?? accountStore
			profileCoId = accountData?.profile?.startsWith('co_') ? accountData.profile : null
		}
		if (!profileCoId) {
			return { id: null, name: travelerFallback(accountCoId), image: null }
		}
		const profileStore = await maia.do({ op: 'read', schema: null, key: profileCoId })
		await waitForStore(profileStore, 5000)
		const profileData = profileStore?.value ?? profileStore
		const name = profileData?.name
		const image =
			typeof profileData?.avatar === 'string' && profileData.avatar.startsWith('co_z')
				? profileData.avatar
				: null
		return {
			id: profileCoId,
			name: typeof name === 'string' && name.length > 0 ? name : travelerFallback(accountCoId),
			image,
		}
	} catch (_e) {
		return { id: null, name: travelerFallback(accountCoId), image: null }
	}
}

/**
 * Resolve account co-ids to profiles (id, name, image)
 * Unified utility: one pass returns profile co-id, display name, and avatar image co-id.
 * @param {Object} maia - MaiaOS instance with maia.do() (operations API)
 * @param {string[]} accountCoIds - Array of account co-ids (co_z...); skips 'everyone' and non-co_z
 * @returns {Promise<Map<string, { id: string|null, name: string, image: string|null }>>} Map of accountCoId → { id, name, image }
 */
export async function resolveAccountCoIdsToProfiles(maia, accountCoIds) {
	const result = new Map()
	if (!maia?.do || !Array.isArray(accountCoIds)) return result

	// Pre-populate "everyone"
	result.set('everyone', { id: null, name: 'Everyone', image: null })

	// Deduplicate and filter to account co-ids only
	const toResolve = [...new Set(accountCoIds)].filter(
		(id) => typeof id === 'string' && id.startsWith('co_z'),
	)

	if (toResolve.length === 0) return result

	const resolved = await Promise.all(
		toResolve.map(async (coId) => {
			const profile = await resolveOneToProfile(maia, coId)
			return [coId, profile]
		}),
	)

	for (const [coId, profile] of resolved) {
		result.set(coId, profile)
	}

	return result
}

/**
 * Resolve account co-id to profile co-id for navigation (e.g. selectCoValue)
 * Uses humans registry when available; falls back to null.
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @param {string} accountCoId - Account co-id (co_z...)
 * @returns {Promise<string|null>} Profile co-id or null
 */
export async function resolveAccountToProfileCoId(maia, accountCoId) {
	return resolveAccountToProfileCoIdViaHumans(maia, accountCoId)
}
