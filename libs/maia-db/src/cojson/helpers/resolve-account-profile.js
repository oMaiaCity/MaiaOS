/**
 * Resolve account co-ids to their profile names
 * Used by db-viewer and other UIs to display human-readable names instead of opaque co-ids
 */

function truncate(str, maxLen = 16) {
	if (typeof str !== 'string') return str;
	if (str.length <= maxLen) return str;
	return str.substring(0, maxLen) + '...';
}

/**
 * Wait for a reactive store to finish loading (if loading)
 * @param {Object} store - Store with .loading and .subscribe()
 * @param {number} timeoutMs - Timeout in ms
 */
async function waitForStore(store, timeoutMs = 5000) {
	const val = store?.value ?? store;
	if (!val?.loading) return;
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Timeout waiting for store')), timeoutMs);
		const unsubscribe = store.subscribe?.((v) => {
			const s = v ?? store?.value ?? store;
			if (!s?.loading) {
				clearTimeout(timeout);
				unsubscribe?.();
				resolve();
			}
		});
		const current = store?.value ?? store;
		if (!current?.loading) {
			clearTimeout(timeout);
			unsubscribe?.();
			resolve();
		}
	});
}

/**
 * Resolve a single account co-id to its profile name
 * @param {Object} maia - MaiaOS instance with maia.db()
 * @param {string} accountCoId - Account co-id (co_z...)
 * @returns {Promise<string>} Profile name or truncated co-id on failure
 */
async function resolveOne(maia, accountCoId) {
	try {
		const accountStore = await maia.db({ op: 'read', schema: '@account', key: accountCoId });
		await waitForStore(accountStore, 5000);
		const accountData = accountStore?.value ?? accountStore;
		if (!accountData?.profile || typeof accountData.profile !== 'string' || !accountData.profile.startsWith('co_')) {
			return truncate(accountCoId, 16);
		}
		const profileCoId = accountData.profile;
		const profileStore = await maia.db({ op: 'read', schema: null, key: profileCoId });
		await waitForStore(profileStore, 5000);
		const profileData = profileStore?.value ?? profileStore;
		const name = profileData?.name ?? profileData?.properties?.find?.(p => p?.key === 'name')?.value;
		return (typeof name === 'string' && name.length > 0) ? name : truncate(accountCoId, 16);
	} catch (e) {
		return truncate(accountCoId, 16);
	}
}

/**
 * Resolve account co-ids to their profile names
 * @param {Object} maia - MaiaOS instance with maia.db() (operations API)
 * @param {string[]} accountCoIds - Array of account co-ids (co_z...); skips 'everyone' and non-co_z
 * @returns {Promise<Map<string, string>>} Map of accountCoId → profile name (or truncated co-id on failure)
 */
export async function resolveAccountCoIdsToProfileNames(maia, accountCoIds) {
	const result = new Map();
	if (!maia?.db || !Array.isArray(accountCoIds)) return result;

	// Pre-populate "everyone"
	result.set('everyone', 'Everyone');

	// Deduplicate and filter to account co-ids only
	const toResolve = [...new Set(accountCoIds)].filter(
		id => typeof id === 'string' && id.startsWith('co_z')
	);

	if (toResolve.length === 0) return result;

	const resolved = await Promise.all(
		toResolve.map(async (coId) => {
			const name = await resolveOne(maia, coId);
			return [coId, name];
		})
	);

	for (const [coId, name] of resolved) {
		result.set(coId, name);
	}

	return result;
}
