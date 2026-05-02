/**
 * Sync storage inspector HTTP client + SYNC SERVER table helpers.
 */
import { getSyncHttpBaseUrl } from '@AvenOS/kernel/client'
import { escapeAttr, escapeHtml } from '../utils.js'

/** PG stores the table as `covalues` (identifier folded); inspector may list either spelling. */
export function isStorageCoValuesTable(name) {
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

export function getSyncStorageApiBase() {
	return getSyncHttpBaseUrl({
		dev: _isDevEnv,
		syncDomain: _syncDomainForPeer(),
		vitePeerSyncHost: import.meta.env?.VITE_PEER_SYNC_HOST,
		windowLocation: typeof window !== 'undefined' ? window.location : null,
	})
}

/** Bearer + `/admin/storage` UCAN; same pattern as LLM chat. */
export async function syncInspectorFetch(path, init = {}) {
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

export function getSyncServerTablesState() {
	return {
		cache: syncServerTablesCache,
		error: syncServerTablesError,
		allowed: syncServerAllowed,
	}
}

export async function loadSyncServerTablesOnce() {
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
export function formatSyncServerCell(val, opts = {}) {
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
