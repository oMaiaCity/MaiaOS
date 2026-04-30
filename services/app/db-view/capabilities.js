/**
 * Capabilities grants table hydration (post-paint).
 */
import { loadCapabilitiesGrants, resolveAccountCoIdsToProfiles } from '@MaiaOS/db'
import { createPerfTracer, debugLog, debugWarn } from '@MaiaOS/logs'
import { escapeHtml } from '../utils.js'
import { buildCapabilitiesGrantRowsHtml } from './capabilities-shared.js'
import { hydrateMembersView } from './members.js'

const perfAppMaiaDb = createPerfTracer('app', 'maia-db')

export async function hydrateCapabilitiesView(maia) {
	try {
		const grants = await perfAppMaiaDb.measure('loadCapabilitiesGrants', () =>
			loadCapabilitiesGrants(maia),
		)
		let profiles = new Map()
		if (grants.length > 0) {
			const subIds = [...new Set(grants.map((g) => g.sub).filter(Boolean))]
			profiles = await perfAppMaiaDb.measure('resolveAccountCoIdsToProfiles (subjects)', () =>
				resolveAccountCoIdsToProfiles(maia, subIds),
			)
		}
		debugLog('app', 'maia-db', 'capabilities grants loaded', { count: grants.length })
		const tbody = document.getElementById('capabilities-tbody')
		if (!tbody) return
		tbody.innerHTML =
			grants.length > 0
				? buildCapabilitiesGrantRowsHtml(grants, profiles)
				: '<tr class="capabilities-empty"><td colspan="6">No capability grants in the Capability index</td></tr>'
		const banner = document.getElementById('capabilities-sync-banner')
		if (banner) banner.remove()
		const countEl = document.getElementById('capabilities-grant-count')
		if (countEl) countEl.textContent = `${grants.length} grant(s)`
		void hydrateMembersView(maia)
	} catch (capErr) {
		debugWarn('app', 'maia-db', 'loadCapabilitiesGrants failed', capErr?.message ?? capErr)
		const tbody = document.getElementById('capabilities-tbody')
		if (tbody) {
			const msg = escapeHtml(String(capErr?.message ?? capErr ?? 'Unknown error'))
			tbody.innerHTML = `<tr class="capabilities-empty"><td colspan="6">Failed to load grants: ${msg}</td></tr>`
		}
		const banner = document.getElementById('capabilities-sync-banner')
		if (banner) banner.remove()
		void hydrateMembersView(maia)
	}
}
