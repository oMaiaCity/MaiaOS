import { collectCapabilityGrantCoIdsFromColistContent } from './capability-grant-co-ids.js'
import { getCapabilityGrantIndexColistCoId } from './capability-grants-resolve.js'

export { getCapabilityGrantIndexColistCoId } from './capability-grants-resolve.js'

/**
 * Load capability grants from the Capability schema index CoList (spark.os.indexes[OS_CAPABILITY]).
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

		const colistId = await getCapabilityGrantIndexColistCoId(maia)
		if (!colistId?.startsWith('co_z')) return []
		capLog('capability index colist id resolved')

		const colistStore = await maia.do({ op: 'read', factory: null, key: colistId })
		await waitForStore(colistStore, 5000)
		capLog('capability index colist hydrated')
		const colistData = colistStore?.value ?? colistStore
		const capCoIds = collectCapabilityGrantCoIdsFromColistContent(colistData)

		capLog(`colist grant refs=${capCoIds.length}`)
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
