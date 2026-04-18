/**
 * Resolve capability group co-ids to human-readable names
 * Format: @SparkName/CapabilityName
 * Used by maia-db to display "via °maia/Guardian" instead of "via co_zVvK79kWN..."
 */

function truncate(str, maxLen = 16) {
	if (typeof str !== 'string') return str
	if (str.length <= maxLen) return str
	return `${str.substring(0, maxLen)}...`
}

function capitalizeCapability(str) {
	if (!str || typeof str !== 'string') return str
	return str.charAt(0).toUpperCase() + str.slice(1)
}

async function waitForStore(store, timeoutMs = 5000) {
	const val = store?.value ?? store
	if (!val?.loading) return
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Timeout')), timeoutMs)
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
 * Build reverse map: group co-id -> @SparkName/CapabilityName
 * Traverses account.sparks -> each spark -> os -> groups -> guardian, publicReaders, etc.
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @param {string} accountId - Current account co-id (from maia.id.maiaId.id)
 * @returns {Promise<Map<string, string>>} Map of groupCoId -> display name
 */
async function buildCapabilityGroupMap(maia, accountId) {
	const result = new Map()
	if (!maia?.db || !accountId?.startsWith('co_')) return result

	try {
		const accountStore = await maia.do({ op: 'read', factory: '@account', key: accountId })
		await waitForStore(accountStore, 5000)
		const accountData = accountStore?.value ?? accountStore
		const sparksId = accountData?.sparks
		if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_')) return result

		const sparksStore = await maia.do({ op: 'read', factory: null, key: sparksId })
		await waitForStore(sparksStore, 5000)
		const sparksRaw = sparksStore?.value ?? sparksStore
		if (!sparksRaw || sparksRaw.error) return result
		const sparksData = sparksRaw

		const skipKeys = new Set(['id', 'loading', 'error', '$factory', 'type', 'cotype'])
		for (const key of Object.keys(sparksData)) {
			if (skipKeys.has(key)) continue
			const sparkCoId =
				typeof sparksData[key] === 'string' && sparksData[key].startsWith('co_')
					? sparksData[key]
					: key.startsWith('co_')
						? key
						: null
			if (!sparkCoId) continue

			try {
				const sparkStore = await maia.do({ op: 'read', factory: null, key: sparkCoId })
				await waitForStore(sparkStore, 3000)
				const sparkRaw = sparkStore?.value ?? sparkStore
				const sparkData = sparkRaw
				const osId = sparkData?.os
				if (!osId?.startsWith('co_')) continue

				const sparkName = sparkData?.name ?? key
				if (
					typeof sparkData?.name === 'string' &&
					sparkData.name.trim() !== '' &&
					!sparkData.name.startsWith('°')
				) {
					throw new Error(
						'[resolveCapabilityGroup] spark name must be a full logical ref starting with °',
					)
				}
				const displaySparkName = typeof sparkName === 'string' ? sparkName : String(key ?? '')

				const osStore = await maia.do({ op: 'read', factory: null, key: osId })
				await waitForStore(osStore, 3000)
				const osRaw = osStore?.value ?? osStore
				const osData = osRaw
				const groupsId = osData?.groups
				if (!groupsId?.startsWith('co_')) continue

				const groupsStore = await maia.do({ op: 'read', factory: null, key: groupsId })
				await waitForStore(groupsStore, 3000)
				const groupsRaw = groupsStore?.value ?? groupsStore
				if (!groupsRaw || groupsRaw.error) continue
				const groupsData = groupsRaw

				for (const capKey of Object.keys(groupsData)) {
					if (skipKeys.has(capKey)) continue
					const groupCoId =
						typeof groupsData[capKey] === 'string' && groupsData[capKey].startsWith('co_')
							? groupsData[capKey]
							: null
					if (!groupCoId) continue

					const capDisplay = capitalizeCapability(capKey)
					result.set(groupCoId, `${displaySparkName}/${capDisplay}`)
				}
			} catch (_e) {
				// Skip this spark on error
			}
		}
	} catch (_e) {
		// Return partial map or empty
	}

	return result
}

/**
 * Resolve group co-ids to capability display names
 * Format: @SparkName/CapabilityName, e.g. "°maia/Guardian"
 * Only resolves capability groups from the current account's sparks; others fall back to truncated co-id
 *
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @param {string[]} groupCoIds - Array of group co-ids (co_z...)
 * @param {string} [accountId] - Account co-id (default: maia.id?.maiaId?.id)
 * @returns {Promise<Map<string, string>>} Map of groupCoId -> display name
 */
export async function resolveGroupCoIdsToCapabilityNames(maia, groupCoIds, accountId = null) {
	const result = new Map()
	if (!maia?.db || !Array.isArray(groupCoIds)) return result

	const toResolve = [...new Set(groupCoIds)].filter(
		(id) => typeof id === 'string' && id.startsWith('co_z'),
	)
	if (toResolve.length === 0) return result

	const aid = accountId ?? maia.id?.maiaId?.id
	const capabilityMap = await buildCapabilityGroupMap(maia, aid)

	for (const coId of toResolve) {
		const name = capabilityMap.get(coId) ?? truncate(coId, 16)
		result.set(coId, name)
	}

	return result
}
