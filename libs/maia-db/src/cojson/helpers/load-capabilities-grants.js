/**
 * Load capability grants from spark.os.capabilities CoStream
 * Resolves: account.registries → sparks → °Maia → os → capabilities
 * Used by MaiaDB Capabilities view (guardian visibility)
 *
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @returns {Promise<Array<{id: string, sub: string, cmd: string, pol: Array, exp: number, iss?: string}>>}
 */
export async function loadCapabilitiesGrants(maia) {
	if (!maia?.do) return []
	const account = maia?.id?.maiaId
	if (!account) return []
	const registriesId = account.get?.('registries')
	if (!registriesId?.startsWith('co_z')) return []

	try {
		// Resolve path: registries → sparks → °Maia → os → capabilities
		const registriesStore = await maia.do({ op: 'read', schema: null, key: registriesId })
		await waitForStore(registriesStore, 5000)
		const registries = registriesStore?.value ?? registriesStore
		const sparksId = registries?.sparks
		if (!sparksId?.startsWith('co_z')) return []

		const sparksStore = await maia.do({ op: 'read', schema: null, key: sparksId })
		await waitForStore(sparksStore, 5000)
		const sparks = sparksStore?.value ?? sparksStore
		const maiaSparkId = sparks?.['°Maia']
		if (!maiaSparkId?.startsWith('co_z')) return []

		const sparkStore = await maia.do({ op: 'read', schema: null, key: maiaSparkId })
		await waitForStore(sparkStore, 5000)
		const spark = sparkStore?.value ?? sparkStore
		const osId = spark?.os
		if (!osId?.startsWith('co_z')) return []

		const osStore = await maia.do({ op: 'read', schema: null, key: osId })
		await waitForStore(osStore, 5000)
		const os = osStore?.value ?? osStore
		const capabilitiesStreamId = os?.capabilities
		if (!capabilitiesStreamId?.startsWith('co_z')) return []

		const streamStore = await maia.do({ op: 'read', schema: null, key: capabilitiesStreamId })
		await waitForStore(streamStore, 5000)
		const streamData = streamStore?.value ?? streamStore
		const rawItems = streamData?.items ?? []
		const capCoIds = rawItems
			.map((item) => (typeof item === 'string' && item.startsWith('co_z') ? item : item?.value))
			.filter((id) => id?.startsWith('co_z'))

		const grants = []
		for (const capCoId of capCoIds) {
			try {
				const capStore = await maia.do({ op: 'read', schema: null, key: capCoId })
				await waitForStore(capStore, 3000)
				const cap = capStore?.value ?? capStore
				if (!cap || cap?.error || cap?.loading) continue
				grants.push({
					id: cap.id ?? capCoId,
					sub: cap.sub,
					cmd: cap.cmd,
					pol: Array.isArray(cap.pol) ? cap.pol : [],
					exp: typeof cap.exp === 'number' ? cap.exp : 0,
					...(cap.iss && { iss: cap.iss }),
					...(cap.nbf != null && { nbf: cap.nbf }),
				})
			} catch (_e) {
				// Skip failed capability loads (permission, sync, etc.)
			}
		}
		return grants
	} catch (_e) {
		return []
	}
}

async function waitForStore(store, timeoutMs = 5000) {
	const val = store?.value ?? store
	if (!val?.loading) return
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Timeout')), timeoutMs)
		const unsub = store?.subscribe?.((v) => {
			const s = v ?? store?.value ?? store
			if (!s?.loading) {
				clearTimeout(timeout)
				unsub?.()
				resolve()
			}
		})
		const current = store?.value ?? store
		if (!current?.loading) {
			clearTimeout(timeout)
			unsub?.()
			resolve()
		}
	})
}
