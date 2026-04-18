/**
 * Maia DB View - Logged-in interface
 * Liquid glass design with widget-based layout
 */

import {
	applyMaiaLoggingFromEnv,
	createLogger,
	createPerfTracer,
	debugLog,
	debugWarn,
	resolveMaiaLoggingEnv,
} from '@MaiaOS/logs'
import { getSyncHttpBaseUrl } from '@MaiaOS/peer'
// Import from kernel bundle - everything bundled (no direct @MaiaOS/db in production)
import {
	listAccountIdsFromIdentityIndex,
	loadCapabilitiesGrants,
	resolveAccountCoIdsToProfiles,
	resolveGroupCoIdsToCapabilityNames,
} from '@MaiaOS/runtime'
import { accountLoadingSpinnerHtml } from './account-loading-spinner-html.js'
import { MAIADB_LAYER_STACK_ICON_SVG } from './maia-icons.js'

const appShellLog = createLogger('app')

/** Same channel as `perfAppMaiaDb` in @MaiaOS/logs — created here so bundled app always resolves (named export can be omitted by some bundles). */
const perfAppMaiaDb = createPerfTracer('app', 'maia-db')

const SYNC_SERVER_PAGE_SIZE = 500

/** PG stores the table as `covalues` (identifier folded); inspector may list either spelling. */
function isStorageCoValuesTable(name) {
	return String(name || '').toLowerCase() === 'covalues'
}

const _isLocalAppHost =
	typeof window !== 'undefined' &&
	(window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1' ||
		window.location.hostname === '[::1]')
const _isDevEnv = import.meta.env?.DEV || _isLocalAppHost
function _syncDomainForPeer() {
	if (_isDevEnv) return null
	return import.meta.env?.VITE_PEER_SYNC_HOST || null
}
function getSyncStorageApiBase() {
	return getSyncHttpBaseUrl({
		dev: _isDevEnv,
		syncDomain: _syncDomainForPeer(),
		vitePeerSyncHost: import.meta.env?.VITE_PEER_SYNC_HOST,
		windowLocation: typeof window !== 'undefined' ? window.location : null,
	})
}

/** Bearer + `/admin/storage` UCAN; same pattern as LLM chat. */
async function syncInspectorFetch(path, init = {}) {
	const base = getSyncStorageApiBase()
	if (!base) throw new Error('Sync URL not configured')
	const maia = globalThis.maia
	const token = await maia?.getCapabilityToken?.({ cmd: '/admin/storage', args: {} })
	if (!token) throw new Error('No /admin/storage capability')
	const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
	const method = (init.method || 'GET').toUpperCase()
	const hasBody = init.body != null && method !== 'GET' && method !== 'HEAD'
	return fetch(url, {
		...init,
		headers: {
			...(hasBody ? { 'Content-Type': 'application/json' } : {}),
			...(init.headers || {}),
			Authorization: `Bearer ${token}`,
		},
	})
}

let syncServerTablesCache = null
let syncServerTablesError = null
/** After probe: true = may use inspector API; false = hide SYNC SERVER (401/403 or no token). */
let syncServerAllowed = false
async function loadSyncServerTablesOnce() {
	if (syncServerTablesCache !== null || syncServerTablesError !== null) return
	const base = getSyncStorageApiBase()
	if (!base) {
		syncServerTablesError = 'Sync URL not configured'
		syncServerAllowed = false
		return
	}
	try {
		const maia = globalThis.maia
		const token = await maia?.getCapabilityToken?.({ cmd: '/admin/storage', args: {} })
		if (!token) {
			syncServerTablesCache = []
			syncServerTablesError = null
			syncServerAllowed = false
			return
		}
		const pageSize = 500
		const allTables = []
		let offset = 0
		let hasMore = true
		while (hasMore) {
			const r = await fetch(`${base}/api/v0/admin/storage/tables?limit=${pageSize}&offset=${offset}`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			if (r.status === 401 || r.status === 403) {
				syncServerTablesCache = []
				syncServerTablesError = null
				syncServerAllowed = false
				return
			}
			if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
			const j = await r.json()
			const page = j.tables || []
			allTables.push(...page)
			hasMore = j.hasMore === true && page.length > 0
			offset += pageSize
		}
		syncServerTablesCache = allTables
		syncServerTablesError = null
		syncServerAllowed = true
	} catch (e) {
		syncServerTablesError = e?.message || String(e)
		syncServerAllowed = true
	}
}

/**
 * @param {unknown} val
 * @param {{ noTruncate?: boolean }} [opts] - full string for wide columns (e.g. header JSON); enables horizontal scroll
 */
function formatSyncServerCell(val, opts = {}) {
	const noTruncate = opts.noTruncate === true
	if (val === null || val === undefined) {
		return '<span class="sync-server-null">NULL</span>'
	}
	if (typeof val === 'string') {
		if (val.startsWith('co_z')) {
			return `<button type="button" class="sync-server-coid-link" data-maia-action="selectCoValue" data-coid="${escapeAttr(val)}">${escapeHtml(val)}</button>`
		}
		if (noTruncate) {
			return `<span class="sync-server-cell-str sync-server-cell-full">${escapeHtml(val)}</span>`
		}
		const full = escapeAttr(val)
		const short = val.length > 120 ? `${escapeHtml(val.slice(0, 120))}…` : escapeHtml(val)
		return `<span class="sync-server-cell-str" title="${full}">${short}</span>`
	}
	if (typeof val === 'object') {
		let s
		try {
			s = JSON.stringify(val)
		} catch {
			s = String(val)
		}
		if (noTruncate) {
			return `<span class="sync-server-cell-json sync-server-cell-full">${escapeHtml(s)}</span>`
		}
		const full = escapeAttr(s)
		const short = s.length > 120 ? `${escapeHtml(s.slice(0, 120))}…` : escapeHtml(s)
		return `<span class="sync-server-cell-json" title="${full}">${short}</span>`
	}
	return escapeHtml(String(val))
}

/** Resolve schema definition from DB (dynamic - factory ref must be co_z) */
async function getFactoryFromDb(maia, factoryRef) {
	if (!factoryRef || !maia?.do) return null
	if (!factoryRef.startsWith('co_z')) return null
	try {
		const factoryStore = await maia.do({ op: 'factory', coId: factoryRef })
		return factoryStore?.value ?? null
	} catch (_e) {
		return null
	}
}

import { renderDashboard, renderVibeViewer } from './dashboard.js'
import { disposeGame, renderGame } from './maia-game-mount.js'
import {
	escapeAttr,
	escapeHtml,
	getProfileAvatarHtml,
	getSyncStatusMessage,
	truncate,
} from './utils.js'

/** Header-resolved factory co_z (`$factoryCoId`) first; legacy fallback: flat `data.$factory` only. */
function factoryRefForDbView(data) {
	if (data.$factoryCoId?.startsWith('co_z')) return data.$factoryCoId
	if (typeof data.$factory === 'string' && data.$factory.length > 0) return data.$factory
	return null
}

/** Expand/collapse CoJSON internal key rows (metadata sidebar). */
export function toggleMetadataInternalKey(btn) {
	const row = btn.closest('.metadata-internal-row')
	if (!row) return
	const truncated = row.querySelector('.metadata-internal-truncated')
	const full = row.querySelector('.metadata-internal-full')
	if (!truncated || !full) return
	const isExpanded = full.style.display !== 'none'
	if (isExpanded) {
		full.style.display = 'none'
		truncated.style.display = ''
		btn.textContent = '⊕'
		btn.setAttribute('aria-label', 'Expand')
	} else {
		truncated.style.display = 'none'
		full.style.display = ''
		btn.textContent = '⊖'
		btn.setAttribute('aria-label', 'Collapse')
	}
}

function formatCapabilitiesExp(exp) {
	if (typeof exp !== 'number' || exp <= 0) return '—'
	const d = new Date(exp * 1000)
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCapabilitiesPolicyDisplay(pol) {
	if (!Array.isArray(pol) || pol.length === 0) return '—'
	return escapeHtml(JSON.stringify(pol))
}

function buildCapabilitiesGrantRowsHtml(grants, profiles) {
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

/** Load grants + profiles after first paint (sync continues in background). */
/** Human registry members + approval (guardian grants /sync/write + /llm/chat). */
async function hydrateMembersView(maia) {
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

async function hydrateCapabilitiesView(maia) {
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

// Cache for CoBinary image data URLs - survives re-renders, enables progressive reactive preview
const cobinaryPreviewCache = new Map()

function extractDataUrl(res) {
	const dataUrl = res?.dataUrl ?? res?.data?.dataUrl ?? (res?.ok === true && res?.data?.dataUrl)
	if (res && !dataUrl) {
		debugWarn('app', 'cobinary', 'extractDataUrl: no dataUrl in response', {
			keys: Object.keys(res || {}),
			hasData: !!res?.data,
			dataKeys: res?.data ? Object.keys(res.data) : [],
		})
	}
	return dataUrl ?? null
}

function loadBinaryWithRetry(maia, coId, maxAttempts = 4) {
	const attempt = (n) =>
		maia
			.do({ op: 'loadBinaryAsBlob', coId })
			.then((res) => extractDataUrl(res))
			.catch((err) => {
				const msg = err?.message ?? ''
				const retryable =
					msg.includes('not found') ||
					msg.includes('not available') ||
					msg.includes('still be loading') ||
					msg.includes('no binary data') ||
					msg.includes('stream not finished') ||
					err?.name === 'NotReadableError'
				if (n < maxAttempts && retryable) {
					return new Promise((r) => setTimeout(r, 300)).then(() => attempt(n + 1))
				}
				throw err
			})
	return attempt(0)
}

/** Hydrate cobinary image previews: load from cache or fetch, then set img.src. Runs after DOM update. */
export function hydrateCobinaryPreviews(maia) {
	debugLog('app', 'cobinary', 'hydrateCobinaryPreviews', { hasMaia: !!maia?.do })
	if (!maia?.do) return
	const imgs = document.querySelectorAll('img[data-co-id]')
	debugLog('app', 'cobinary', 'hydrateCobinaryPreviews found imgs', imgs.length)
	imgs.forEach((img) => {
		const coId = img.getAttribute('data-co-id')
		if (!coId?.startsWith('co_z')) {
			debugLog('app', 'cobinary', 'hydrateCobinaryPreviews skip invalid coId', { coId })
			return
		}
		if (img.src && (img.src.startsWith('data:') || img.src.startsWith('blob:'))) return
		const cached = cobinaryPreviewCache.get(coId)
		if (cached?.dataUrl) {
			img.src = cached.dataUrl
			return
		}
		if (cached?.loading) {
			cached.loading.then((dataUrl) => {
				const current = document.querySelector(`img[data-co-id="${coId}"]`)
				if (current) {
					if (dataUrl) current.src = dataUrl
					else current.alt = 'Preview unavailable'
				}
			})
			return
		}
		debugLog('app', 'cobinary', 'loadBinaryAsBlob start', { coId })
		const loading = loadBinaryWithRetry(maia, coId)
			.then((dataUrl) => {
				cobinaryPreviewCache.set(coId, { dataUrl })
				debugLog('app', 'cobinary', 'loadBinaryAsBlob done', {
					coId,
					hasDataUrl: !!dataUrl,
					len: dataUrl?.length,
				})
				return dataUrl
			})
			.catch((err) => {
				debugWarn('app', 'cobinary', 'loadBinaryAsBlob failed', { coId, err: err?.message })
				return null
			})
		cobinaryPreviewCache.set(coId, { loading })
		loading.then((dataUrl) => {
			const current = document.querySelector(`img[data-co-id="${coId}"]`)
			if (current) {
				if (dataUrl) current.src = dataUrl
				else current.alt = 'Preview unavailable'
			}
		})
	})
}

export async function renderApp(
	maia,
	authState,
	syncState,
	currentScreen,
	currentView,
	currentContextCoValueId,
	currentVibe,
	currentSpark,
	switchView,
	selectCoValue,
	loadVibe,
	loadSpark,
	navigateToScreen,
	capabilityGrantsIndexColistCoId,
	syncServerSelectedTable = null,
	syncServerTableOffset = 0,
	clearSyncServerSelectionIfDenied,
) {
	// Re-apply LOG_MODE every render: in-memory perf/debug gates reset on HMR; ensures perf.all works after clicks.
	if (typeof window !== 'undefined') {
		applyMaiaLoggingFromEnv(resolveMaiaLoggingEnv())
	}

	if (currentScreen !== 'the-game') {
		disposeGame()
	}
	document.body.classList.toggle('screen-maia-db', currentScreen === 'maia-db')
	document.body.classList.toggle('screen-the-game', currentScreen === 'the-game')

	if (currentScreen === 'dashboard') {
		await renderDashboard(
			maia,
			authState,
			syncState,
			navigateToScreen,
			currentSpark,
			loadSpark,
			loadVibe,
		)
		hydrateCobinaryPreviews(maia)
		setTimeout(() => hydrateCobinaryPreviews(maia), 500)
		return
	}

	if (currentScreen === 'vibe-viewer' && currentVibe) {
		await renderVibeViewer(maia, authState, syncState, currentVibe, navigateToScreen, currentSpark)
		hydrateCobinaryPreviews(maia)
		setTimeout(() => hydrateCobinaryPreviews(maia), 500)
		return
	}

	if (currentScreen === 'the-game') {
		// Do not await: loading + Three.js mount can take seconds; awaiting would keep
		// renderAppInternal's isRendering lock and drop navigateToScreen (e.g. home) until load finishes.
		void renderGame().catch((err) => {
			appShellLog.error('[Maia game] render failed', err)
		})
		return
	}

	// DB viewer requires signed-in account (maia.id = { maiaId, node })
	if (!maia?.id?.maiaId || !maia.id.node) {
		debugLog('app', 'maia-db', 'gate blocked (no maia kernel)', {
			hasMaia: !!maia,
			hasMaiaId: !!maia?.id?.maiaId,
			hasNode: !!maia?.id?.node,
			signedIn: authState?.signedIn,
			currentScreen,
			currentContextCoValueId,
		})
		const isLoading = authState?.signedIn
		const message = isLoading ? 'Loading account…' : 'Please sign in to view the DB.'
		document.getElementById('app').innerHTML = `
			<div class="loading-connecting-overlay">
				${isLoading ? accountLoadingSpinnerHtml : ''}
				<div class="loading-connecting-content">
					<h2>${message}</h2>
					${isLoading ? '<div class="loading-connecting-subtitle">Setting up your sovereign self…</div>' : ''}
				</div>
			</div>
		`
		return
	}

	// Default: render MaiaDB (currentScreen === 'maia-db')
	perfAppMaiaDb.start(
		`renderApp view=${currentView} syncTable=${syncServerSelectedTable ?? ''} ctx=${String(currentContextCoValueId ?? '').slice(0, 32)}`,
	)
	try {
		// CoJSON internal keys: sealer/signer, KEY_..._FOR_SEALER_..., and agent IDs as map keys - shown in metadata sidebar
		const isCoJsonInternalKey = (key, value) => {
			const k = String(key).toLowerCase()
			if (k === 'sealer' || k === 'signer') return true
			// Keys can BE agent IDs or revelation keys (e.g. "sealer_z.../signer_z..." or "key_z..._for_sealer_z.../signer_z...")
			if (k.startsWith('sealer_') && k.includes('/signer_')) return true
			if (k.startsWith('key_') && k.includes('_for_sealer_')) return true
			// Identity index + co_z ids are user data — not internal CoJSON sealer metadata
			if (typeof key === 'string' && key.startsWith('co_')) return false
			if (typeof value === 'string' && value.startsWith('co_')) return false
			if (typeof value !== 'string') return false
			const v = value.toLowerCase()
			return (
				v.startsWith('sealer_') ||
				v.includes('/signer_') ||
				(v.startsWith('key_') && v.includes('_for_sealer_'))
			)
		}

		// Helper to render any value consistently
		const renderValue = (value, depth = 0) => {
			if (depth > 2) return '<span class="nested-depth">...</span>'
			if (value === null) return '<span class="text-xs italic null-value text-slate-400">null</span>'
			if (value === undefined)
				return '<span class="text-xs italic undefined-value text-slate-400">undefined</span>'

			if (typeof value === 'string') {
				if (value.startsWith('co_')) {
					return `<code class="text-xs co-id text-marine-blue-muted hover:underline clickable" data-maia-action="selectCoValue" data-coid="${escapeAttr(value)}" title="${escapeAttr(value)}">${truncate(value, 12)}</code>`
				}
				if (value.startsWith('key_')) {
					return `<code class="text-xs key-value text-marine-blue-muted" title="${value}">${truncate(value, 30)}</code>`
				}
				if (value.startsWith('sealed_')) {
					return '<code class="text-xs italic sealed-value text-marine-blue-muted">sealed_***</code>'
				}

				const maxLength = 100
				const truncated = value.length > maxLength ? `${value.substring(0, maxLength)}...` : value
				return `<span class="min-w-0 text-xs text-right break-all string-value text-marine-blue-muted" title="${value}">"${escapeHtml(truncated)}"</span>`
			}

			if (typeof value === 'boolean') {
				return `<span class="boolean-value ${value ? 'true' : 'false'} text-xs font-semibold ${value ? 'text-lush-green bg-lush-green/10' : 'text-marine-blue-muted bg-white/10'} px-1.5 py-0.5 rounded">${value}</span>`
			}

			if (typeof value === 'number') {
				return `<span class="text-xs font-medium number-value text-marine-blue-muted">${value}</span>`
			}

			if (Array.isArray(value)) {
				// Truncate array preview to max 24 characters
				const preview = `[${value.length} ${value.length === 1 ? 'item' : 'items'}]`
				const truncated = preview.length > 24 ? `${preview.substring(0, 21)}...` : preview
				return `<span class="text-xs italic array-value text-marine-blue-light" title="${escapeHtml(JSON.stringify(value))}">${escapeHtml(truncated)}</span>`
			}

			if (typeof value === 'object' && value !== null) {
				// Create a compact JSON preview string, truncated to max 24 characters total (including "OBJECT >")
				const objectIndicator = ' OBJECT >'
				const maxJsonLength = 24 - objectIndicator.length // Reserve space for " OBJECT >"

				try {
					const jsonString = JSON.stringify(value)
					let truncated = jsonString
					if (jsonString.length > maxJsonLength) {
						truncated = `${jsonString.substring(0, maxJsonLength - 3)}...`
					}
					return `<span class="text-xs italic object-value text-marine-blue-light" title="${escapeHtml(jsonString)}">${escapeHtml(truncated)}<span class="text-marine-blue-light/50">${objectIndicator}</span></span>`
				} catch (_e) {
					// Fallback if JSON.stringify fails
					const keys = Object.keys(value)
					const preview = `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`
					let truncated = preview
					if (preview.length > maxJsonLength) {
						truncated = `${preview.substring(0, maxJsonLength - 3)}...`
					}
					return `<span class="text-xs italic object-value text-marine-blue-light">${escapeHtml(truncated)}<span class="text-marine-blue-light/50">${objectIndicator}</span></span>`
				}
			}

			return `<span class="text-xs text-marine-blue-muted">${escapeHtml(String(value))}</span>`
		}

		// Helper to format JSON properly (parse if string, then stringify with indentation)
		const formatJSON = (value) => {
			if (typeof value === 'string') {
				// Try to parse as JSON first
				try {
					const parsed = JSON.parse(value)
					return JSON.stringify(parsed, null, 2)
				} catch (_e) {
					// Not valid JSON, return as-is
					return value
				}
			} else if (Array.isArray(value)) {
				// Explicitly handle arrays
				return JSON.stringify(value, null, 2)
			} else if (typeof value === 'object' && value !== null) {
				// Handle objects
				return JSON.stringify(value, null, 2)
			} else {
				return String(value)
			}
		}

		// Helper to render a property row consistently
		const renderPropertyRow = (
			label,
			value,
			type,
			key,
			isExpandable = false,
			expandId = '',
			_schemaTitle = '',
		) => {
			const typeClass = type ? type.replace(/-/g, '') : 'unknown'
			const isCoIdClickable = type === 'co-id'
			const isClickable = isCoIdClickable || isExpandable

			let dataActionAttrs = ''
			if (isCoIdClickable) {
				dataActionAttrs = `data-maia-action="selectCoValue" data-coid="${escapeAttr(String(value))}"`
			} else if (isExpandable) {
				dataActionAttrs = `data-maia-action="toggleExpand" data-expand-id="${escapeAttr(expandId)}"`
			}

			return `
			<div class="w-full property-item-wrapper">
				<button 
					type="button"
					class="list-item-card property-item-button w-full ${isClickable ? 'hoverable' : ''} group"
					${dataActionAttrs}
				>
					<div class="flex gap-3 justify-between items-center">
						<!-- Left side: Property Key -->
						<div class="flex flex-shrink-0 gap-2 items-center min-w-0">
							<span class="text-[10px] font-bold text-marine-blue-light uppercase tracking-widest truncate group-hover:text-marine-blue transition-colors" title="${key}">
								${label}
							</span>
							${isExpandable ? `<svg class="w-3 h-3 transition-colors text-marine-blue-light/50 group-hover:text-marine-blue expand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>` : ''}
						</div>
						
						<!-- Right side: Value and Badge -->
						<div class="flex flex-1 gap-2.5 justify-end items-center min-w-0">
							<div class="flex flex-1 justify-end truncate value-container">
								${renderValue(value)}
							</div>
							<span class="badge badge-type badge-${typeClass} text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-tighter rounded-md border border-white/50 shadow-sm">${type.toUpperCase()}</span>
							${
								isClickable
									? `
								<svg class="w-3 h-3 transition-colors text-marine-blue-light/50 group-hover:text-marine-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
							`
									: ''
							}
						</div>
					</div>
				</button>
				${
					isExpandable
						? `
					<div id="${expandId}" class="p-3 mt-1 rounded-b-xl border-t backdrop-blur-md expanded-content bg-white/20 border-white/10" style="display: none;">
						<pre class="json-display text-[11px] font-mono text-marine-blue-muted leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(formatJSON(value))}</pre>
					</div>
				`
						: ''
				}
			</div>
		`
		}

		// Get account and node for navigation
		const account = maia.id.maiaId
		const _node = maia.id.node

		await loadSyncServerTablesOnce()
		let effectiveSyncTable = syncServerSelectedTable
		if (syncServerAllowed === false && syncServerSelectedTable) {
			clearSyncServerSelectionIfDenied?.()
			effectiveSyncTable = null
		}

		// Get data based on current view
		let data, viewTitle, _viewSubtitle
		let tableContent = ''
		let headerInfo = null
		const syncServerPanel = Boolean(effectiveSyncTable)

		// Default to showing account if no context is set (not when SYNC SERVER table is selected)
		if (!syncServerPanel && !currentContextCoValueId && account?.id) {
			currentContextCoValueId = account.id
		}

		// SYNC SERVER — raw PG table (storage inspector API)
		if (effectiveSyncTable) {
			viewTitle = effectiveSyncTable
			headerInfo = null
			const base = getSyncStorageApiBase()
			if (!base) {
				tableContent = `<div class="sync-server-table-error">Sync URL not configured.</div>`
			} else {
				const quoted = `"${String(effectiveSyncTable).replace(/"/g, '""')}"`
				const offset = Math.max(0, Number(syncServerTableOffset) || 0)
				const coValuesTable = isStorageCoValuesTable(effectiveSyncTable)
				const sqlRows = coValuesTable
					? `SELECT (COALESCE(NULLIF(TRIM(header::json->'meta'->>'$factory'), ''), CASE WHEN header::json->'ruleset'->>'type' = 'group' THEN 'group' END)) AS factory, * FROM ${quoted} LIMIT ${SYNC_SERVER_PAGE_SIZE} OFFSET ${offset}`
					: `SELECT * FROM ${quoted} LIMIT ${SYNC_SERVER_PAGE_SIZE} OFFSET ${offset}`
				const sqlCount = `SELECT COUNT(*)::bigint AS cnt FROM ${quoted}`
				try {
					const [cRes, qRes, nRes] = await Promise.all([
						syncInspectorFetch(
							`/api/v0/admin/storage/tables/${encodeURIComponent(effectiveSyncTable)}/columns`,
							{ method: 'GET' },
						),
						syncInspectorFetch(`/api/v0/admin/storage/query`, {
							method: 'POST',
							body: JSON.stringify({ sql: sqlRows }),
						}),
						syncInspectorFetch(`/api/v0/admin/storage/query`, {
							method: 'POST',
							body: JSON.stringify({ sql: sqlCount }),
						}),
					])
					const cJson = await cRes.json().catch(() => ({}))
					const qJson = await qRes.json().catch(() => ({}))
					const nJson = await nRes.json().catch(() => ({}))
					if (!cRes.ok) {
						tableContent = `<div class="sync-server-table-error">${escapeHtml(cJson.error || `columns ${cRes.status}`)}</div>`
					} else if (!qRes.ok || qJson.ok === false) {
						tableContent = `<div class="sync-server-table-error">${escapeHtml(qJson.error || `query ${qRes.status}`)}</div>`
					} else if (!nRes.ok || nJson.ok === false) {
						tableContent = `<div class="sync-server-table-error">${escapeHtml(nJson.error || `count ${nRes.status}`)}</div>`
					} else {
						const columns = cJson.columns || []
						const rows = qJson.rows || []
						const countRow = nJson.rows?.[0]
						let totalRows = null
						if (countRow && typeof countRow === 'object') {
							const raw = countRow.cnt ?? countRow.CNT ?? Object.values(countRow)[0]
							const n = Number(raw)
							if (Number.isFinite(n)) totalRows = n
						}
						const describeNames = columns.map((c) => c.name).filter(Boolean)
						const colNames =
							qJson.fields?.length > 0
								? qJson.fields
								: coValuesTable
									? ['factory', ...describeNames]
									: describeNames
						const headerRow = colNames
							.map((name) => {
								const col = columns.find(
									(c) => c.name === name || c.name?.toLowerCase() === String(name).toLowerCase(),
								)
								const tip = col?.dataType ? escapeAttr(String(col.dataType)) : ''
								const label = name
								const isHeaderCol = String(name).toLowerCase() === 'header'
								const thClass = [
									'sync-server-th',
									name === 'factory' ? 'sync-server-th-factory' : '',
									isHeaderCol ? 'sync-server-th-header' : '',
								]
									.filter(Boolean)
									.join(' ')
								return `<th class="${thClass}" title="${tip}">${escapeHtml(label)}</th>`
							})
							.join('')
						const bodyRows = rows
							.map((row) => {
								const tds = colNames
									.map((name) => {
										const v = row[name] ?? row[name.toLowerCase()] ?? row[name.toUpperCase()]
										const isHeaderCol = String(name).toLowerCase() === 'header'
										const tdClass = [
											'sync-server-td',
											name === 'factory' ? 'sync-server-td-factory' : '',
											isHeaderCol ? 'sync-server-td-header' : '',
										]
											.filter(Boolean)
											.join(' ')
										return `<td class="${tdClass}">${formatSyncServerCell(v, { noTruncate: isHeaderCol })}</td>`
									})
									.join('')
								return `<tr class="sync-server-tr">${tds}</tr>`
							})
							.join('')
						const rowStart = rows.length === 0 ? 0 : offset + 1
						const rowEnd = offset + rows.length
						const rangeLabel =
							rows.length === 0
								? 'No rows'
								: totalRows != null
									? `Rows ${rowStart}–${rowEnd} of ${totalRows}`
									: `Rows ${rowStart}–${rowEnd}${rows.length === SYNC_SERVER_PAGE_SIZE ? ' (more may exist)' : ''}`
						const prevDisabled = offset === 0
						const nextDisabled =
							totalRows != null
								? offset + rows.length >= totalRows || rows.length === 0
								: rows.length < SYNC_SERVER_PAGE_SIZE
						tableContent = `
			<div class="sync-server-table-wrap">
				<div class="sync-server-sticky-toolbar">
					<div class="sync-server-pagination" role="navigation" aria-label="Table pages">
						<button type="button" class="sync-server-page-btn" data-maia-action="syncServerPagePrev" ${prevDisabled ? 'disabled' : ''}>Previous</button>
						<span class="sync-server-page-range">${escapeHtml(rangeLabel)}</span>
						<button type="button" class="sync-server-page-btn" data-maia-action="syncServerPageNext" ${nextDisabled ? 'disabled' : ''}>Next</button>
					</div>
				</div>
				<div class="sync-server-table-scroll">
					<table class="sync-server-table" aria-label="Storage table ${escapeAttr(effectiveSyncTable)}">
						<thead><tr>${headerRow}</tr></thead>
						<tbody>${bodyRows || `<tr><td class="sync-server-td" colspan="${colNames.length}">No rows</td></tr>`}</tbody>
					</table>
				</div>
			</div>
		`
					}
				} catch (err) {
					tableContent = `<div class="sync-server-table-error">${escapeHtml(err?.message || String(err))}</div>`
				}
			}
		} else if (
			capabilityGrantsIndexColistCoId &&
			currentContextCoValueId === capabilityGrantsIndexColistCoId &&
			maia
		) {
			debugLog('app', 'maia-db', 'render capabilities view (shell; grants load in background)', {
				hasDo: !!maia?.do,
			})
			data = { _capabilitiesView: true, grants: [], _loading: true }
			viewTitle = 'Capabilities'
			_viewSubtitle = ''
			headerInfo = {
				type: 'capabilities',
				typeLabel: 'Grants',
				itemCount: null,
				description: 'spark.os.indexes (Capability schema index CoList)',
			}
			tableContent = `
			<div class="capabilities-table-wrap">
				<nav class="capabilities-subtab-nav" role="tablist" aria-label="Capabilities sections">
					<button type="button" class="capabilities-subtab capabilities-subtab-active" role="tab" aria-selected="true" data-maia-action="capabilitiesSubTab" data-subtab="members">Members</button>
					<button type="button" class="capabilities-subtab" role="tab" aria-selected="false" data-maia-action="capabilitiesSubTab" data-subtab="grants">Grants</button>
				</nav>
				<div class="capabilities-subtab-panel" data-subtab-panel="members" data-capabilities-active="true">
					<p class="capabilities-sync-banner" id="capabilities-members-banner" role="status">
						<span class="capabilities-loading-spinner" aria-hidden="true"></span>
						<span>Loading members…</span>
					</p>
					<table class="capabilities-table">
						<thead>
							<tr>
								<th class="capabilities-th">Member</th>
								<th class="capabilities-th">Account</th>
								<th class="capabilities-th">Status</th>
								<th class="capabilities-th">Expires</th>
								<th class="capabilities-th capabilities-th-actions"></th>
							</tr>
						</thead>
						<tbody id="capabilities-members-tbody">
							<tr class="capabilities-row capabilities-row-loading">
								<td colspan="5" class="capabilities-loading-cell">
									<span class="text-marine-blue-light text-sm">Loading rows…</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="capabilities-subtab-panel capabilities-subtab-panel-hidden" data-subtab-panel="grants" data-capabilities-active="false">
				<p class="capabilities-sync-banner" id="capabilities-sync-banner" role="status">
					<span class="capabilities-loading-spinner" aria-hidden="true"></span>
					<span>Syncing capability grants…</span>
				</p>
				<table class="capabilities-table">
					<thead>
						<tr>
							<th class="capabilities-th">Subject</th>
							<th class="capabilities-th">Command</th>
							<th class="capabilities-th">Expires</th>
							<th class="capabilities-th">Policy</th>
							<th class="capabilities-th">ID</th>
							<th class="capabilities-th capabilities-th-actions"></th>
						</tr>
					</thead>
					<tbody id="capabilities-tbody">
						<tr class="capabilities-row capabilities-row-loading">
							<td colspan="6" class="capabilities-loading-cell">
								<span class="text-marine-blue-light text-sm">Loading rows…</span>
							</td>
						</tr>
					</tbody>
				</table>
				</div>
			</div>
		`
		} else if (currentContextCoValueId && maia) {
			// Explorer-style navigation: if a CoValue is loaded into context, show it in main container
			try {
				// Use unified read API - query by ID (key parameter)
				// Note: schema is required by ReadOperation, but backend handles key-only reads
				// Using the coId as schema is a workaround - backend will use key parameter
				const store = await maia.do({
					op: 'read',
					factory: currentContextCoValueId,
					key: currentContextCoValueId,
				})
				// ReadOperation returns a ReactiveStore - get current value
				const contextData = store.value || store
				// Operations API returns flat objects: {id: '...', profile: '...', registries: '...'}
				// Convert to normalized format for DB Viewer display
				const hasProperties =
					contextData &&
					typeof contextData === 'object' &&
					!Array.isArray(contextData) &&
					Object.keys(contextData).filter(
						(k) => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$factory' && k !== 'type',
					).length > 0
				const _propertiesCount = hasProperties
					? Object.keys(contextData).filter(
							(k) => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$factory' && k !== 'type',
						).length
					: 0

				data = contextData

				// Subscribe to ReactiveStore updates for reactivity
				if (typeof store.subscribe === 'function') {
					// Count properties from flat object (exclude metadata keys)
					const flatPropertyCount =
						contextData && typeof contextData === 'object' && !Array.isArray(contextData)
							? Object.keys(contextData).filter(
									(k) => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$factory' && k !== 'type',
								).length
							: 0
					let lastPropertiesCount = contextData?.loading ? -1 : flatPropertyCount
					let lastLoadingState = contextData?.loading || false
					let lastDataHash = JSON.stringify({
						propsCount: lastPropertiesCount,
						loading: lastLoadingState,
						hasError: !!contextData?.error,
					})

					store.subscribe((updatedData) => {
						// Check if data actually changed (properties appeared, loading state changed, etc.)
						// Count properties from flat object (exclude metadata keys)
						const currentFlatPropertyCount =
							updatedData && typeof updatedData === 'object' && !Array.isArray(updatedData)
								? Object.keys(updatedData).filter(
										(k) => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$factory' && k !== 'type',
									).length
								: 0
						const currentPropertiesCount = updatedData?.loading ? -1 : currentFlatPropertyCount
						const currentLoadingState = updatedData?.loading || false
						const currentDataHash = JSON.stringify({
							propsCount: currentPropertiesCount,
							loading: currentLoadingState,
							hasError: !!updatedData?.error,
						})

						const dataChanged = currentDataHash !== lastDataHash

						if (updatedData && dataChanged) {
							lastPropertiesCount = currentPropertiesCount
							lastLoadingState = currentLoadingState
							lastDataHash = currentDataHash
							setTimeout(() => {
								renderApp(
									maia,
									authState,
									syncState,
									currentScreen,
									currentView,
									currentContextCoValueId,
									currentVibe,
									currentSpark,
									switchView,
									selectCoValue,
									loadVibe,
									loadSpark,
									navigateToScreen,
									capabilityGrantsIndexColistCoId,
									syncServerSelectedTable,
									syncServerTableOffset,
									clearSyncServerSelectionIfDenied,
								)
							}, 0)
						}
					})
					// ReactiveStore handles cleanup automatically
				}
				// Use ID as title (no displayName logic)
				viewTitle = contextData.id ? truncate(contextData.id, 24) : 'CoValue'
				_viewSubtitle = ''
			} catch (err) {
				data = { error: err.message, id: currentContextCoValueId, loading: false }
				viewTitle = 'Error'
				_viewSubtitle = ''
			}
		} else if (currentView && maia) {
			// Filter by schema
			// ReadOperation requires schema to be a co-id (co_z...)
			// If currentView is not a co-id, get all CoValues and filter manually
			try {
				if (currentView.startsWith('co_z')) {
					// Schema is already a co-id - use unified read API
					const store = await maia.do({ op: 'read', schema: currentView })
					// ReadOperation returns a ReactiveStore - get current value
					const result = store.value || store
					data = Array.isArray(result) ? result : []

					// Subscribe to ReactiveStore updates for reactivity
					if (typeof store.subscribe === 'function') {
						let lastLength = result.length
						store.subscribe((updatedResult) => {
							// Re-render when store updates (check if data actually changed)
							if (updatedResult && Array.isArray(updatedResult) && updatedResult.length !== lastLength) {
								lastLength = updatedResult.length
								// Use setTimeout to prevent infinite loops and batch updates
								setTimeout(() => {
									renderApp(
										maia,
										authState,
										syncState,
										currentScreen,
										currentView,
										currentContextCoValueId,
										currentVibe,
										currentSpark,
										switchView,
										selectCoValue,
										loadVibe,
										loadSpark,
										navigateToScreen,
										capabilityGrantsIndexColistCoId,
										syncServerSelectedTable,
										syncServerTableOffset,
										clearSyncServerSelectionIfDenied,
									)
								}, 0)
							}
						})
						// ReactiveStore handles cleanup automatically
					}
				} else {
					data = []
				}
			} catch (_err) {
				data = []
			}
			const schema = await getFactoryFromDb(maia, currentView)
			viewTitle = schema?.title || currentView
			_viewSubtitle = `${Array.isArray(data) ? data.length : 0} CoValue(s)`
		} else {
			// Default: show account ID if available
			viewTitle = account?.id ? truncate(account.id, 24) : 'CoValue'
			_viewSubtitle = ''
		}

		// Build account structure navigation (Account + Capabilities)
		const navigationItems = []

		// Entry 1: Account itself
		navigationItems.push({
			id: account.id,
			label: 'Account',
			type: 'account',
		})
		if (capabilityGrantsIndexColistCoId) {
			navigationItems.push({
				id: capabilityGrantsIndexColistCoId,
				label: 'Capabilities',
				type: 'capabilities',
			})
		}

		// Build table content based on view (tableContent/headerInfo already set by capabilities branch if applicable)
		// DB Viewer only shows DB content (no agent rendering here)
		// SYNC SERVER already set tableContent — do not fall through to the empty-state else (would wipe the grid).
		if (!syncServerPanel && currentContextCoValueId && data) {
			// Capabilities view: tableContent already set above
			if (!data._capabilitiesView) {
				// Explorer-style: if context CoValue is loaded, show its properties in main container
				// Show CoValue properties in main container (reuse property rendering from detail view)
				if (data.error && !data.loading) {
					tableContent = `<div class="p-8 font-medium text-center text-rose-500 rounded-2xl border border-rose-100 empty-state bg-rose-50/50">Error: ${data.error}</div>`
				} else if (data.loading) {
					tableContent = `
				<div class="flex flex-col justify-center items-center p-12 rounded-2xl border empty-state bg-slate-50/50 border-slate-100">
					<div class="w-8 h-8 rounded-full border-4 animate-spin loading-spinner border-slate-200 border-t-slate-400"></div>
					<p class="mt-4 font-medium text-slate-500">Loading CoValue... (waiting for verified state)</p>
				</div>
			`
				} else if ((data._coValueType || data.cotype || data.type) === 'cobinary') {
					// CoBinary: Display binary stream metadata (co-id, mimeType, size, finished)
					headerInfo = {
						type: 'cobinary',
						typeLabel: 'CoBinary',
						description: 'Binary file stream',
					}
					const mimeType = data.mimeType || 'application/octet-stream'
					const totalSizeBytes = data.totalSizeBytes ?? null
					const finished = data.finished ?? false
					const sizeStr = totalSizeBytes != null ? `${(totalSizeBytes / 1024).toFixed(1)} KB` : '?'
					const isImage = mimeType.startsWith('image/')
					let previewHtml = ''
					if (isImage && data.id && maia?.do) {
						previewHtml = `
					<div class="mt-4 p-4 bg-slate-50/50 rounded-xl border border-slate-200" style="width:100%;max-width:100%;min-width:0;overflow:hidden">
						<p class="text-xs text-slate-500 mb-2">Image preview (loads on demand)</p>
						<div style="width:100%;max-width:100%;min-width:0;overflow:hidden">
							<img id="cobinary-preview-${data.id.replace(/[^a-zA-Z0-9]/g, '_')}" style="width:100%;max-width:100%;max-height:280px;height:auto;object-fit:contain;display:block;border-radius:6px;border:1px solid #e2e8f0" alt="Binary preview" data-co-id="${escapeHtml(data.id)}" />
						</div>
					</div>
				`
					}
					tableContent = `
				<div class="space-y-4 cobinary-container">
					<div class="grid grid-cols-2 gap-3 text-sm">
						<div class="font-medium text-slate-500">Co-ID</div>
						<div class="text-marine-blue-muted font-mono text-xs">${escapeHtml(data.id || '')}</div>
						<div class="font-medium text-slate-500">MIME type</div>
						<div class="text-marine-blue-muted">${escapeHtml(mimeType)}</div>
						<div class="font-medium text-slate-500">Size</div>
						<div class="text-marine-blue-muted">${sizeStr}</div>
						<div class="font-medium text-slate-500">Complete</div>
						<div class="text-marine-blue-muted">${finished ? 'Yes' : 'No'}</div>
					</div>
					${previewHtml}
				</div>
			`
					// Image preview loaded reactively via hydrateCobinaryPreviews (after innerHTML)
				} else if (
					(data._coValueType || data.cotype || data.type) === 'colist' ||
					(data._coValueType || data.cotype || data.type) === 'costream'
				) {
					// CoList/CoStream: Display items directly (they ARE the list/stream, no properties)
					// STRICT: Ensure items is always array (read API may return object/undefined for index colists)
					const raw = data?.items
					const items = Array.isArray(raw)
						? raw
						: raw && typeof raw === 'object' && !Array.isArray(raw)
							? Object.values(raw)
							: []
					const isStream = (data._coValueType || data.cotype || data.type) === 'costream'
					const typeLabel = isStream ? 'CoStream' : 'CoList'

					// Store header info for display in inspector-header
					headerInfo = {
						type: data._coValueType || data.cotype || data.type,
						typeLabel: typeLabel,
						itemCount: items.length,
						description: isStream ? 'Append-only stream' : 'Ordered list',
					}

					const itemRows = items
						.map((item, index) => {
							const label = `#${index + 1}`
							let type = typeof item
							if (typeof item === 'string' && item.startsWith('co_')) {
								type = 'co-id'
							} else if (Array.isArray(item)) {
								type = 'array'
							} else if (typeof item === 'object' && item !== null) {
								type = 'object'
							}

							// Make objects and arrays expandable
							const isExpandable = (typeof item === 'object' && item !== null) || Array.isArray(item)
							const expandId = isExpandable
								? `expand-item-${index}-${Math.random().toString(36).substr(2, 9)}`
								: ''

							return renderPropertyRow(label, item, type, label, isExpandable, expandId)
						})
						.join('')

					tableContent = `
				<div class="space-y-4 list-stream-container">
					<div class="space-y-1 list-view-container">
						${items.length > 0 ? itemRows : `<div class="p-8 italic text-center rounded-xl border border-dashed text-slate-400 bg-slate-50/30 border-slate-200">No items in this ${typeLabel.toLowerCase()}</div>`}
					</div>
				</div>
			`
				} else if (
					data &&
					typeof data === 'object' &&
					!Array.isArray(data) &&
					!data.error &&
					!data.loading
				) {
					// CoMap: Display properties from flat object format (operations API)
					// Convert flat object to normalized format for display
					const factoryCoId = factoryRefForDbView(data)
					const schemaDef = factoryCoId?.startsWith('co_z')
						? await getFactoryFromDb(maia, factoryCoId)
						: null

					// Extract properties from flat object (exclude metadata keys)
					// groupInfo is backend-derived metadata (not a co-value property) - only show in metadata sidebar
					// CoJSON internal keys (sealer, signer, KEY_..._FOR_SEALER_...) go to metadata sidebar, not main view
					const propertyKeys = Object.keys(data).filter(
						(k) =>
							k !== 'id' &&
							k !== 'loading' &&
							k !== 'error' &&
							k !== '$factory' &&
							k !== '$factoryCoId' &&
							k !== 'schema' &&
							k !== 'type' &&
							k !== 'cotype' && // Display only in metadata aside, not as main content property
							k !== '_coValueType' && // Internal: actual CRDT type of this CoValue (display metadata)
							k !== 'displayName' &&
							k !== 'headerMeta' &&
							k !== 'groupInfo' && // Backend metadata - displayed in metadata sidebar, not as a property
							!isCoJsonInternalKey(k, data[k]),
					)

					if (propertyKeys.length === 0) {
						// No properties - show empty state (with hint for avens/factories/indexes).
						// Schema id may be co_z — also match factory namekey on the CoValue (humans-registry / avens-registry).
						const factoryTag = `${factoryCoId ?? ''} ${data.$factory ?? ''} ${data.$factoryCoId ?? ''}`
						const isRegistryEmpty =
							factoryTag.includes('avens-registry') ||
							factoryTag.includes('humans-registry') ||
							factoryTag.includes('factories-registry') ||
							factoryTag.includes('indexes-registry')
						const emptyHint = isRegistryEmpty
							? '<p class="mt-3 text-sm text-amber-600 max-w-md mx-auto">Vibes and registry scaffolds come from the sync server (<code class="bg-amber-100 px-1 rounded">bun dev</code> on :4201). Humans/avens registry rows are CoMap entries (username or account co-id → identity co-id); the same data powers the Addressbook grid.</p>'
							: ''
						tableContent = `<div class="p-12 italic text-center rounded-2xl border border-dashed empty-state text-slate-400 bg-slate-50/30 border-slate-200">No properties available${emptyHint}</div>`
					} else {
						const propertyItems = propertyKeys
							.map((key) => {
								const value = data[key]
								let propType = typeof value

								// Detect co-id references (including CoText refs - click to load in detail view)
								if (typeof value === 'string' && value.startsWith('co_')) {
									propType = 'co-id'
								} else if (typeof value === 'string' && value.startsWith('key_')) {
									propType = 'key'
								} else if (typeof value === 'string' && value.startsWith('sealed_')) {
									propType = 'sealed'
								} else if (Array.isArray(value)) {
									propType = 'array'
								} else if (typeof value === 'object' && value !== null) {
									propType = 'object'
								}

								const propSchema = schemaDef?.properties?.[key]
								const sparkOsKeyLabels = {
									metaFactoryCoId: 'MetaFactory',
								}
								const propLabel = propSchema?.title || sparkOsKeyLabels[key] || key

								// Make objects and arrays expandable
								const isExpandable =
									propType === 'object' ||
									propType === 'array' ||
									(typeof value === 'object' && value !== null && !Array.isArray(value)) ||
									Array.isArray(value)
								const expandId = isExpandable
									? `expand-${key}-${Math.random().toString(36).substr(2, 9)}`
									: ''

								return renderPropertyRow(propLabel, value, propType, key, isExpandable, expandId)
							})
							.join('')

						tableContent = `
					<div class="space-y-1 list-view-container">
						${propertyItems}
					</div>
				`
					}
				} else {
					// Fallback: empty or no properties
					tableContent =
						'<div class="p-12 italic text-center rounded-2xl border border-dashed empty-state text-slate-400 bg-slate-50/30 border-slate-200">No properties available</div>'
				}
			}
		} else if (!syncServerPanel) {
			// Default view - show list of CoValues or error
			tableContent =
				'<div class="p-12 italic text-center rounded-2xl border border-dashed empty-state text-slate-400 bg-slate-50/30 border-slate-200">Select a CoValue to explore its content</div>'
		}

		// Get account ID and resolve profile (name + image) for navbar display
		const accountId = maia?.id?.maiaId?.id || ''
		let accountProfile = null
		if (accountId?.startsWith('co_z') && maia?.do) {
			try {
				const profiles = await resolveAccountCoIdsToProfiles(maia, [accountId])
				accountProfile = profiles.get(accountId) ?? null
			} catch (_e) {}
		}
		const accountDisplayName = accountProfile?.name ?? truncate(accountId, 12)
		const accountAvatarHtml = getProfileAvatarHtml(accountProfile?.image, {
			size: 44,
			className: 'navbar-avatar',
		})
		// Metadata sidebar (explorer-style navigation; skip for capabilities view)
		let metadataSidebar = ''
		if (currentContextCoValueId && data && !data.error && !data.loading && !data._capabilitiesView) {
			const groupInfo = data.groupInfo || null

			// Flattened "Members with access": each row is (who, role, source)
			// Inherited roles (= via parent group) are only shown under "via" to avoid duplicates
			const flattenedMembers = []
			const viaMemberIds = new Set()
			if (groupInfo?.groupMembers) {
				for (const g of groupInfo.groupMembers) {
					for (const m of g.members || []) {
						viaMemberIds.add(m.id)
						flattenedMembers.push({
							who: m.id,
							role: m.role || 'reader',
							source: `via ${truncate(g.id, 12)}`,
							viaGroupId: g.id, // Parent group/capability – link to this CoValue, not the account
						})
					}
				}
			}
			if (groupInfo?.accountMembers) {
				for (const m of groupInfo.accountMembers) {
					// Skip inherited: already shown under "via" above
					if (m.isInherited && viaMemberIds.has(m.id)) continue
					flattenedMembers.push({
						who: m.id,
						role: m.role || 'reader',
						source: m.isInherited ? 'inherited' : 'direct',
					})
				}
			}
			// Sort: everyone first, then by source (direct, then via…, then inherited)
			const sourceOrder = (s) => (s === 'direct' ? 0 : s === 'inherited' ? 2 : 1)
			flattenedMembers.sort((a, b) => {
				if (a.who === 'everyone') return -1
				if (b.who === 'everyone') return 1
				return sourceOrder(a.source) - sourceOrder(b.source) || String(a.who).localeCompare(b.who)
			})
			const hasMembers = flattenedMembers.length > 0

			// Fetch schema title if schema is a co-id using the abstracted read operation API
			let schemaTitle = null
			const factoryCoId = factoryRefForDbView(data)
			if (factoryCoId?.startsWith('co_z') && maia) {
				try {
					// Use unified read API - same pattern as loading main context data
					const factoryStore = await maia.do({ op: 'read', factory: factoryCoId, key: factoryCoId })
					const schemaData = factoryStore.value || factoryStore

					if (schemaData && !schemaData.error && !schemaData.loading) {
						// Operations API returns flat objects: {id: '...', title: '...', definition: {...}, ...}
						if (schemaData && typeof schemaData === 'object' && !Array.isArray(schemaData)) {
							// Check title directly
							if (schemaData.title && typeof schemaData.title === 'string') {
								schemaTitle = schemaData.title
							}
							// Also check definition.title for schema definitions
							if (!schemaTitle && schemaData.definition && typeof schemaData.definition === 'object') {
								schemaTitle = schemaData.definition.title || null
							}
						}
					}
				} catch (_e) {}
			}

			// Fetch group name if group ID is available (groups are CoMaps, so they can have a "name" property)
			let groupName = null
			if (groupInfo?.groupId && maia) {
				try {
					// Use unified read API with @group schema hint (groups don't have $factory)
					const groupStore = await maia.do({ op: 'read', factory: '@group', key: groupInfo.groupId })

					// Wait for group data to be available (if it's loading)
					if (groupStore.loading) {
						await new Promise((resolve, reject) => {
							const timeout = setTimeout(() => {
								reject(new Error('Timeout waiting for group data'))
							}, 5000)
							const unsubscribe = groupStore.subscribe(() => {
								if (!groupStore.loading) {
									clearTimeout(timeout)
									unsubscribe()
									resolve()
								}
							})
						})
					}

					const groupData = groupStore.value || groupStore

					if (groupData && !groupData.error && !groupData.loading) {
						if (groupData.name && typeof groupData.name === 'string') {
							groupName = groupData.name
						}
					}
				} catch (_e) {}
			}

			// Resolve account co-ids to profiles (name + avatar) for members display
			let profiles = new Map()
			if (hasMembers && maia) {
				try {
					const accountCoIds = flattenedMembers.map((row) => row.who).filter((id) => id)
					profiles = await resolveAccountCoIdsToProfiles(maia, accountCoIds)
				} catch (_e) {}
			}

			// Resolve capability group co-ids to display names (e.g. °maia/Guardian)
			let capabilityNames = new Map()
			if (maia && account?.id) {
				try {
					const groupCoIds = [
						...new Set([
							...(groupInfo?.groupId ? [groupInfo.groupId] : []),
							...(flattenedMembers?.map((row) => row.viaGroupId).filter(Boolean) ?? []),
						]),
					]
					capabilityNames = await resolveGroupCoIdsToCapabilityNames(maia, groupCoIds, account.id)
				} catch (_e) {}
			}

			metadataSidebar = `
			<aside class="db-metadata">
				<div class="metadata-content">
					<!-- Consolidated Metadata View (no tabs) -->
					<div class="metadata-info-list">
						<!-- ID first (item's own ID) -->
						<div class="metadata-info-item metadata-info-id-row">
							<span class="metadata-info-key">ID</span>
							<div class="metadata-info-value-wrap">
								<code class="metadata-info-value" title="${escapeHtml(data.id || '')}">${truncate(data.id, 24)}</code>
								<button type="button" class="metadata-copy-id" title="Copy full ID" data-maia-action="copyId" data-copy-id="${escapeHtml(data.id || '')}">⎘</button>
							</div>
						</div>
						${
							factoryCoId
								? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">@Factory</span>
								${
									factoryCoId.startsWith('co_')
										? `
									${
										schemaTitle
											? `
										<code class="metadata-info-value co-id" data-maia-action="selectCoValue" data-coid="${escapeAttr(factoryCoId)}" title="${escapeAttr(factoryCoId)}" style="cursor: pointer; text-decoration: underline;">
											${escapeHtml(schemaTitle)}
										</code>
										<div class="metadata-info-schema-id" title="${factoryCoId}">${truncate(factoryCoId, 24)}</div>
									`
											: `
										<code class="metadata-info-value co-id" data-maia-action="selectCoValue" data-coid="${escapeAttr(factoryCoId)}" title="${escapeAttr(factoryCoId)}" style="cursor: pointer; text-decoration: underline;">
											${truncate(factoryCoId, 24)}
										</code>
									`
									}
								`
										: `
									<code class="metadata-info-value" title="${factoryCoId}">
										${factoryCoId}
									</code>
								`
								}
							</div>
						`
								: ''
						}
						<div class="metadata-info-item">
							<span class="metadata-info-key">CO TYPE</span>
						<span class="badge badge-type badge-${String(data._coValueType || data.cotype || data.type || 'unknown').replace(/-/g, '')}">
							${(data._coValueType || data.cotype || data.type) === 'colist' ? 'COLIST' : (data._coValueType || data.cotype || data.type) === 'costream' ? 'COSTREAM' : (data._coValueType || data.cotype || data.type) === 'cobinary' ? 'COBINARY' : String(data._coValueType || data.cotype || data.type || 'unknown').toUpperCase()}
						</span>
						</div>
						${
							groupInfo?.groupId
								? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">OWNER</span>
								${
									groupName || capabilityNames.get(groupInfo.groupId)
										? `
									<div style="display: flex; flex-direction: column; gap: 2px;">
										<span class="metadata-info-value" style="font-weight: 600; color: #1e293b;">
											${escapeHtml(groupName || capabilityNames.get(groupInfo.groupId))}
										</span>
										<code class="co-id" data-maia-action="selectCoValue" data-coid="${escapeAttr(groupInfo.groupId)}" title="${escapeAttr(groupInfo.groupId)}" style="cursor: pointer; text-decoration: underline; font-size: 11px; color: #64748b;">
											${truncate(groupInfo.groupId, 24)}
										</code>
									</div>
								`
										: `
									<code class="metadata-info-value co-id" data-maia-action="selectCoValue" data-coid="${escapeAttr(groupInfo.groupId)}" title="${escapeAttr(groupInfo.groupId)}" style="cursor: pointer; text-decoration: underline;">
										${truncate(groupInfo.groupId, 24)}
									</code>
								`
								}
							</div>
						`
								: ''
						}
					</div>
					${
						// CoJSON internal keys (sealer/signer, KEY_..._FOR_SEALER_...) - only for CoMaps
						(() => {
							if (!data || typeof data !== 'object' || Array.isArray(data)) return ''
							const internalKeys = Object.keys(data).filter((k) => isCoJsonInternalKey(k, data[k]))
							if (internalKeys.length === 0) return ''
							return `
					<div class="metadata-section metadata-internal-keys" style="margin-top: 12px;">
						<h4 class="metadata-section-title">Internal keys</h4>
						<div class="metadata-info-list" style="margin-top: 4px;">
							${internalKeys
								.map((k) => {
									const val = String(data[k])
									return `
							<div class="metadata-info-item metadata-internal-row">
								<div class="metadata-internal-truncated">
									<code class="metadata-info-key-internal">${escapeHtml(truncate(k, 28))}</code>
									<code class="metadata-info-value-internal">${escapeHtml(truncate(val, 32))}</code>
								</div>
								<div class="metadata-internal-full" style="display:none">
									<code class="metadata-info-key-internal">${escapeHtml(k)}</code>
									<code class="metadata-info-value-internal">${escapeHtml(val)}</code>
								</div>
								<button type="button" class="metadata-expand-btn" data-maia-action="toggleMetadataInternalKey" aria-label="Expand">⊕</button>
							</div>`
								})
								.join('')}
						</div>
					</div>
							`
						})()
					}
					<!-- Members with access: single flattened list (who, role, source) - no separate Parent Groups section -->
					${
						groupInfo
							? hasMembers
								? `
							<div class="metadata-members">
								<div class="metadata-section">
									<h4 class="metadata-section-title">Members with access</h4>
									<div class="metadata-info-hint" style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
										Who has access, their role, and whether it's direct or via a group
									</div>
									<div class="metadata-members-list">
										${flattenedMembers
											.map((row) => {
												const isEveryone = row.who === 'everyone'
												const roleClass = row.role?.toLowerCase() || 'reader'
												const displayName = isEveryone
													? 'Everyone'
													: (profiles.get(row.who)?.name ??
														(row.who?.startsWith?.('sealer_') || row.who?.startsWith?.('signer_')
															? `Agent ${truncate(row.who, 12)}`
															: truncate(row.who, 16)))
												// Row 1: account name. Row 2: group name (link) or "direct", both left-aligned
												const groupLinkHtml = row.viaGroupId
													? `<code class="co-id" data-maia-action="selectCoValue" data-coid="${escapeAttr(row.viaGroupId)}" title="${escapeAttr(row.viaGroupId)}" style="cursor: pointer; text-decoration: underline; font-size: 9px;">${escapeHtml(capabilityNames.get(row.viaGroupId) ?? truncate(row.viaGroupId, 12))}</code>`
													: null
												const sourceLine = row.viaGroupId
													? groupLinkHtml
													: row.source
														? escapeHtml(row.source)
														: null
												return `
												<div class="metadata-member-item ${isEveryone ? 'everyone' : ''}" title="${escapeHtml(String(row.role))} access — ${escapeHtml(row.source)}${!isEveryone ? ` (${escapeHtml(row.who)})` : ''}">
													<div class="metadata-member-info">
														<span class="metadata-member-id">${escapeHtml(displayName)}</span>
														${sourceLine ? `<div class="metadata-member-via">${sourceLine}</div>` : ''}
													</div>
													<span class="badge badge-role badge-${roleClass}">${row.role}</span>
												</div>
											`
											})
											.join('')}
									</div>
								</div>
							</div>
						`
								: `
							<div class="metadata-empty">No member information available for this group.</div>
						`
							: ''
					}
				</div>
			</aside>
		`
		}

		// Build sidebar navigation items (Account only - vibes via spark.os.vibes)
		const sidebarItems = navigationItems
			.map((item) => {
				// Explorer — Account / Capabilities
				const isActive =
					!syncServerPanel &&
					(currentContextCoValueId === item.id ||
						(currentView === 'account' && !currentContextCoValueId))

				return `
			<div class="sidebar-item ${isActive ? 'active' : ''}" data-maia-action="selectCoValue" data-coid="${escapeAttr(item.id)}" role="button" tabindex="0">
				<div class="sidebar-label">
					<span class="sidebar-name">${item.label}</span>
					${item.count !== undefined ? `<span class="sidebar-count">${item.count}</span>` : ''}
				</div>
			</div>
		`
			})
			.join('')

		const syncTableList = syncServerTablesCache || []
		const syncServerSidebarHtml = syncTableList
			.map((t) => {
				const active = effectiveSyncTable === t
				return `
			<div class="sidebar-item ${active ? 'active' : ''}" data-maia-action="selectSyncServerTable" data-table="${escapeAttr(t)}" role="button" tabindex="0">
				<div class="sidebar-label">
					<span class="sidebar-name">${escapeHtml(t)}</span>
				</div>
			</div>
		`
			})
			.join('')
		const syncServerSidebarFooter = syncServerTablesError
			? `<div class="sync-server-sidebar-error" role="status">${escapeHtml(syncServerTablesError)}</div>`
			: ''

		perfAppMaiaDb.step('data + sidebars ready → paint', {
			context: currentContextCoValueId,
			view: currentView,
		})

		document.getElementById('app').innerHTML = `
		<div class="db-container">
			<div class="navbar-section">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<span class="db-header-maia-icon" aria-hidden="true">${MAIADB_LAYER_STACK_ICON_SVG}</span>
						<h1>Maia DB</h1>
					</div>
					<div class="header-center">
						<!-- Logo centered in navbar -->
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						${
							authState.signedIn
								? `
							${accountAvatarHtml ? `<div class="account-nav-group"><span class="account-display-name">${escapeHtml(accountDisplayName)}</span><button type="button" class="db-status account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" data-maia-action="toggleMobileMenu" aria-label="Toggle account menu">${accountAvatarHtml}</button></div>` : `<button type="button" class="db-status db-status-name account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" data-maia-action="toggleMobileMenu" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>`}
						`
								: ''
						}
					</div>
				</div>
			</header>
			<!-- Account dropdown - standalone card below navbar -->
			<div class="mobile-menu" id="mobile-menu">
				${
					authState.signedIn && accountId
						? `
					<div class="mobile-menu-account">
						${accountAvatarHtml ? `<div class="mobile-menu-account-avatar">${accountAvatarHtml}</div>` : ''}
						<div class="mobile-menu-account-info">
							<span class="mobile-menu-account-name">${escapeHtml(accountDisplayName)}</span>
							<div class="mobile-menu-account-id-row">
								<button type="button" class="mobile-menu-copy-id" title="Copy ID" data-maia-action="copyId" data-copy-id="${escapeHtml(accountId)}">⎘</button>
								<code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(truncate(accountId, 24))}</code>
							</div>
						</div>
					</div>
				`
						: ''
				}
				${
					authState.signedIn
						? `
					<button type="button" class="mobile-menu-item sign-out-btn" data-maia-action="signOut">
						Sign Out
					</button>
				`
						: ''
				}
			</div>
			</div>

			<div class="db-layout">
				<aside class="db-sidebar">
					<div class="sidebar-content-inner">
						<div class="sidebar-coid-search">
							<input
								type="text"
								id="coid-search-input"
								class="coid-search-input"
								placeholder="co_z..."
								autocomplete="off"
								aria-label="Load CoValue by ID"
								data-maia-enter-load-covalue="1"
							/>
							<button type="button" class="coid-search-btn" data-maia-action="loadCoValueById" aria-label="Load CoValue">
								Load
							</button>
						</div>
						<div class="sidebar-header">
							<h3>Explorer</h3>
						</div>
						<div class="sidebar-content">
							${sidebarItems}
						</div>
						${
							syncServerAllowed === true
								? `
						<div class="sidebar-header sidebar-header-sync-server">
							<h3>SYNC SERVER</h3>
						</div>
						<div class="sidebar-content">
							${syncServerSidebarHtml}
							${syncServerSidebarFooter}
						</div>
						`
								: ''
						}
					</div>
				</aside>
				
				<main class="db-main">
					<div class="inspector">
						<div class="inspector-content-inner">
							<div class="inspector-header">
								<div class="flex flex-grow gap-3 items-center">
									${
										currentContextCoValueId && data?.id
											? `
										<code class="co-id-header">${truncate(data.id, 32)}</code>
									`
											: `
										<h2>${viewTitle}</h2>
									`
									}
									${
										headerInfo
											? `
										<span class="badge badge-type badge-${headerInfo.type} text-[10px] px-2 py-1 font-bold uppercase tracking-widest rounded-lg border border-white/50 shadow-sm">${headerInfo.typeLabel}</span>
										${
											data?._capabilitiesView
												? `<span class="text-sm font-semibold text-marine-blue"><span id="capabilities-members-count">…</span> · <span id="capabilities-grant-count">${data?._loading ? '…' : `${(data.grants || []).length} grant(s)`}</span></span>`
												: headerInfo.itemCount != null
													? `<span class="text-sm font-semibold text-marine-blue">${headerInfo.itemCount} ${headerInfo.itemCount === 1 ? 'Item' : 'Items'}</span>`
													: ''
										}
										<span class="text-xs italic font-medium text-marine-blue-light">${headerInfo.description}</span>
									`
											: ''
									}
									${
										!headerInfo && (data?._coValueType || data?.cotype || data?.type)
											? `
									<span class="badge badge-type badge-${String(data._coValueType || data.cotype || data.type || 'comap').replace(/-/g, '')} text-[10px] px-2 py-1 font-bold uppercase tracking-widest rounded-lg border border-white/50 shadow-sm">${(data._coValueType || data.cotype || data.type) === 'colist' ? 'COLIST' : (data._coValueType || data.cotype || data.type) === 'costream' ? 'COSTREAM' : String(data._coValueType || data.cotype || data.type || 'COMAP').toUpperCase()}</span>
								`
											: ''
									}
								</div>
							</div>
							<div class="inspector-content">
								${tableContent}
							</div>
						</div>
					</div>
				</main>
				
				${metadataSidebar}
			</div>

			<!-- MaiaDB navigation latches and back notch -->
			<button type="button" class="db-latch db-latch-left" id="db-latch-left" data-maia-action="toggleDBLeftSidebar" aria-label="Toggle Explorer sidebar">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
			</button>
			
			${
				currentContextCoValueId
					? `
				<button type="button" class="db-notch-back" data-maia-action="goBack" title="Back" aria-label="Back">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
					<span>back</span>
				</button>
			`
					: ''
			}

			<button type="button" class="db-latch db-latch-right" id="db-latch-right" data-maia-action="toggleDBRightSidebar" aria-label="Toggle detail sidebar">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
			</button>
		</div>
	`

		if (
			capabilityGrantsIndexColistCoId &&
			currentContextCoValueId === capabilityGrantsIndexColistCoId &&
			maia
		) {
			void hydrateCapabilitiesView(maia)
		}

		// Hydrate CoBinary image previews (loadBinaryAsBlob uses chunked async conversion for large files)
		hydrateCobinaryPreviews(maia)
		// Deferred re-hydration: CoBinary may not be ready immediately (sync/lazy-load)
		setTimeout(() => hydrateCobinaryPreviews(maia), 500)

		// Add sidebar toggle handlers for DB viewer
		setTimeout(() => {
			// Ensure sidebars are initialized with collapsed class by default
			// Don't add sidebar-ready class initially to prevent ghost animations
			const leftSidebar = document.querySelector('.db-sidebar')
			const rightSidebar = document.querySelector('.db-metadata')

			if (leftSidebar) {
				// Start collapsed by default, no transitions
				leftSidebar.classList.add('collapsed')
			}
			if (rightSidebar) {
				// Start collapsed by default, no transitions
				rightSidebar.classList.add('collapsed')
			}
		}, 100)
	} finally {
		perfAppMaiaDb.end('renderApp')
	}
}
