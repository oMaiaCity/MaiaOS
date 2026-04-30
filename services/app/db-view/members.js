/**
 * Capabilities shell — human registry members (guardian approval flow).
 */
import {
	debugWarn,
	listAccountIdsFromIdentityIndex,
	loadCapabilitiesGrants,
	resolveAccountCoIdsToProfiles,
} from '@MaiaOS/runtime'
import { escapeAttr, escapeHtml, getProfileAvatarHtml, truncate } from '../utils.js'
import { formatCapabilitiesExp } from './capabilities-shared.js'

export async function hydrateMembersView(maia) {
	const tbody = document.getElementById('capabilities-members-tbody')
	const banner = document.getElementById('capabilities-members-banner')
	if (!tbody) return
	try {
		const peer = maia?.dataEngine?.peer
		if (!peer?.account?.get) {
			tbody.innerHTML = '<tr class="capabilities-empty"><td colspan="5">Peer not ready</td></tr>'
			if (banner) banner.remove()
			return
		}
		const account = maia.id?.maiaId
		if (!account?.id?.startsWith?.('co_z')) {
			tbody.innerHTML = '<tr class="capabilities-empty"><td colspan="5">Account not ready</td></tr>'
			if (banner) banner.remove()
			return
		}
		const accountStore = await maia.do({ op: 'read', factory: '@account', key: account.id })
		const accountData = accountStore.value || accountStore
		const sparksId = accountData?.sparks
		if (!sparksId?.startsWith('co_z')) {
			tbody.innerHTML =
				'<tr class="capabilities-empty"><td colspan="5">No sparks linked yet (complete signup with sync)</td></tr>'
			if (banner) banner.remove()
			return
		}
		if (peer.dbEngine?.resolveSystemFactories) {
			await peer.dbEngine.resolveSystemFactories()
		}
		const accountIdKeys = await listAccountIdsFromIdentityIndex(peer, 'human')
		if (!accountIdKeys?.length) {
			tbody.innerHTML =
				'<tr class="capabilities-empty"><td colspan="5">No humans in identity index yet</td></tr>'
			if (banner) banner.remove()
			return
		}
		const grants = await loadCapabilitiesGrants(maia)
		const nowSec = Math.floor(Date.now() / 1000)
		const profiles =
			accountIdKeys.length > 0 ? await resolveAccountCoIdsToProfiles(maia, accountIdKeys) : new Map()

		const rows = accountIdKeys
			.map((aid) => {
				const gWrite = grants.find((g) => g.sub === aid && g.cmd === '/sync/write' && g.exp > nowSec)
				const gLlm = grants.find((g) => g.sub === aid && g.cmd === '/llm/chat' && g.exp > nowSec)
				const approved = !!(gWrite && gLlm)
				const expVals = [gWrite?.exp, gLlm?.exp].filter((x) => typeof x === 'number' && x > nowSec)
				const earliestExp = expVals.length ? Math.min(...expVals) : null
				const profile = profiles.get(aid)
				const displayName = profile?.name ?? truncate(aid, 16)
				const avatarHtml = getProfileAvatarHtml(profile?.image ?? null, {
					size: 24,
					className: 'capabilities-avatar',
				})
				const subjectHtml = `<span class="capabilities-subject-wrap">${avatarHtml}<span>${escapeHtml(displayName)}</span></span>`
				const statusBadge = approved
					? '<span class="capabilities-member-status capabilities-member-approved">Approved</span>'
					: '<span class="capabilities-member-status capabilities-member-pending">Pending</span>'
				const expCell =
					approved && earliestExp != null ? escapeHtml(formatCapabilitiesExp(earliestExp)) : '—'
				const actions = approved
					? `<button type="button" class="capabilities-revoke-btn" data-maia-action="revokeMember" data-account-id="${escapeAttr(aid)}" title="Revoke /sync/write and /llm/chat">Revoke</button>`
					: `<button type="button" class="capabilities-extend-btn" data-maia-action="approveMember" data-account-id="${escapeAttr(aid)}" title="Grant /sync/write and /llm/chat (30d)">Approve</button>`
				return {
					accountId: aid,
					approved,
					sortKey: approved ? 1 : 0,
					earliestExp: earliestExp ?? 0,
					html: `
					<tr class="capabilities-row ${approved ? 'capabilities-row-active' : ''}">
						<td class="capabilities-cell capabilities-subject">${subjectHtml}</td>
						<td class="capabilities-cell"><code class="capabilities-id" data-maia-action="selectCoValue" data-coid="${escapeAttr(aid)}" title="${escapeHtml(aid)}">${truncate(aid, 12)}</code></td>
						<td class="capabilities-cell">${statusBadge}</td>
						<td class="capabilities-cell capabilities-expiry">${expCell}</td>
						<td class="capabilities-cell capabilities-actions">${actions}</td>
					</tr>`,
				}
			})
			.sort((a, b) => {
				if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
				if (a.approved !== b.approved) return 0
				return (a.earliestExp || 0) - (b.earliestExp || 0)
			})

		tbody.innerHTML =
			rows.length > 0
				? rows.map((r) => r.html).join('')
				: '<tr class="capabilities-empty"><td colspan="5">No humans in registry</td></tr>'
		const countEl = document.getElementById('capabilities-members-count')
		if (countEl) countEl.textContent = `${rows.length} human(s)`
		if (banner) banner.remove()
	} catch (e) {
		debugWarn('app', 'maia-db', 'hydrateMembersView failed', e?.message ?? e)
		tbody.innerHTML = `<tr class="capabilities-empty"><td colspan="5">${escapeHtml(String(e?.message ?? e ?? 'Error'))}</td></tr>`
		if (banner) banner.remove()
	}
}
