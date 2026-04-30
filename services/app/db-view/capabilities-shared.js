import { escapeAttr, escapeHtml, getProfileAvatarHtml, truncate } from '../utils.js'

export function formatCapabilitiesExp(exp) {
	if (typeof exp !== 'number' || exp <= 0) return '—'
	const d = new Date(exp * 1000)
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatCapabilitiesPolicyDisplay(pol) {
	if (!Array.isArray(pol) || pol.length === 0) return '—'
	return escapeHtml(JSON.stringify(pol))
}

export function buildCapabilitiesGrantRowsHtml(grants, profiles) {
	const nowSec = Math.floor(Date.now() / 1000)
	return grants
		.map((g, i) => {
			const profile = profiles.get(g.sub)
			const displayName = profile?.name ?? truncate(g.sub, 16)
			const avatarHtml = getProfileAvatarHtml(profile?.image ?? null, {
				size: 24,
				className: 'capabilities-avatar',
			})
			const subjectHtml = `<span class="capabilities-subject-wrap">${avatarHtml}<span>${escapeHtml(displayName)}</span></span>`
			const expired = typeof g.exp === 'number' && g.exp > 0 && g.exp < nowSec
			const rowClass = `capabilities-row ${i % 2 === 0 ? 'capabilities-row-even' : 'capabilities-row-odd'}${expired ? ' capabilities-row-expired' : ' capabilities-row-active'}`
			const currentExp = typeof g.exp === 'number' ? g.exp : 0
			return `
			<tr class="${rowClass}">
				<td class="capabilities-cell capabilities-subject">${subjectHtml}</td>
				<td class="capabilities-cell"><span class="capabilities-cmd">${escapeHtml(g.cmd || '—')}</span></td>
				<td class="capabilities-cell capabilities-expiry">${escapeHtml(formatCapabilitiesExp(g.exp))}</td>
				<td class="capabilities-cell capabilities-policy">${formatCapabilitiesPolicyDisplay(g.pol)}</td>
				<td class="capabilities-cell"><code class="capabilities-id" data-maia-action="selectCoValue" data-coid="${escapeAttr(g.id)}" title="${escapeHtml(g.id)}">${truncate(g.id, 12)}</code></td>
				<td class="capabilities-cell capabilities-actions">
					<button type="button" class="capabilities-extend-btn" data-maia-action="extendCapability" data-cap-id="${escapeAttr(g.id)}" data-cap-exp="${currentExp}" title="Extend expiry by 1 day">+1 day</button>
					<button type="button" class="capabilities-revoke-btn" data-maia-action="revokeCapability" data-revoke-id="${escapeAttr(g.id)}" data-cmd="${escapeHtml(g.cmd || '')}" data-sub="${escapeHtml(g.sub || '')}" title="Revoke capability">Delete</button>
				</td>
			</tr>
		`
		})
		.join('')
}
