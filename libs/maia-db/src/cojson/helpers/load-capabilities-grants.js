import { collectCapabilityGrantCoIdsFromStreamContent } from './capability-stream-co-ids.js'

/**
 * Co-id of spark.os.capabilities (CoStream), or null.
 * @param {Object} maia - MaiaOS instance with maia.do()
 * @returns {Promise<string|null>}
 */
export async function getCapabilitiesStreamCoId(maia) {
	if (!maia?.do) return null
	const account = maia?.id?.maiaId
	if (!account) return null
	const registriesId = account.get?.('registries')
	if (!registriesId?.startsWith('co_z')) return null
	try {
		const registriesStore = await maia.do({ op: 'read', factory: null, key: registriesId })
		await waitForStore(registriesStore, 5000)
		const registries = registriesStore?.value ?? registriesStore
		const sparksId = registries?.sparks
		if (!sparksId?.startsWith('co_z')) return null
		const sparksStore = await maia.do({ op: 'read', factory: null, key: sparksId })
		await waitForStore(sparksStore, 5000)
		const sparks = sparksStore?.value ?? sparksStore
		const peer = maia.dataEngine?.peer
		const maiaSparkId = peer?.systemSparkCoId ?? sparks?.['°Maia']
		if (!maiaSparkId?.startsWith('co_z')) return null
		const sparkStore = await maia.do({ op: 'read', factory: null, key: maiaSparkId })
		await waitForStore(sparkStore, 5000)
		const spark = sparkStore?.value ?? sparkStore
		const osId = spark?.os
		if (!osId?.startsWith('co_z')) return null
		const osStore = await maia.do({ op: 'read', factory: null, key: osId })
		await waitForStore(osStore, 5000)
		const os = osStore?.value ?? osStore
		const capabilitiesStreamId = os?.capabilities
		return capabilitiesStreamId?.startsWith('co_z') ? capabilitiesStreamId : null
	} catch {
		return null
	}
}

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

	try {
		const devCap =
			typeof globalThis !== 'undefined' && globalThis.window?.__MAIA_DEV_ENV__?.DEV === true
		const tCap0 = devCap ? performance.now() : 0
		const capLog = (label) => {
			if (devCap) {
				// biome-ignore lint/suspicious/noConsole: localhost dev timing for slow capabilities path
				console.info(`[MaiaDB capabilities path] ${label} +${(performance.now() - tCap0).toFixed(0)}ms`)
			}
		}

		const capabilitiesStreamId = await getCapabilitiesStreamCoId(maia)
		if (!capabilitiesStreamId?.startsWith('co_z')) return []
		capLog('capabilities stream id resolved')

		const streamStore = await maia.do({ op: 'read', factory: null, key: capabilitiesStreamId })
		await waitForStore(streamStore, 5000)
		capLog('capabilities stream hydrated')
		const streamData = streamStore?.value ?? streamStore
		const capCoIds = collectCapabilityGrantCoIdsFromStreamContent(streamData)

		capLog(`stream grant refs=${capCoIds.length}`)
		// Load grant CoValues in parallel — sequential reads multiplied latency (~3s × N per waitForStore).
		const grantRows = await Promise.all(
			capCoIds.map(async (capCoId) => {
				try {
					const capStore = await maia.do({ op: 'read', factory: null, key: capCoId })
					await waitForStore(capStore, 3000)
					const cap = capStore?.value ?? capStore
					if (!cap || cap?.error || cap?.loading) return null
					return {
						id: cap.id ?? capCoId,
						sub: cap.sub,
						cmd: cap.cmd,
						pol: Array.isArray(cap.pol) ? cap.pol : [],
						exp: typeof cap.exp === 'number' ? cap.exp : 0,
						...(cap.iss && { iss: cap.iss }),
						...(cap.nbf != null && { nbf: cap.nbf }),
					}
				} catch (_e) {
					return null
				}
			}),
		)
		const grants = grantRows.filter(Boolean)
		capLog(`grants loaded count=${grants.length}`)
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
