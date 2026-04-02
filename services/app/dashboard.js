/**
 * Dashboard and Vibe Viewer Rendering
 * Handles dashboard screen and vibe viewer rendering
 */

import { getAllVibeRegistries, resolveAccountCoIdsToProfiles } from '@MaiaOS/loader'
import { createPerfTracer } from '@MaiaOS/logs'
import { findSessionChatIntentActorId, PERSISTENT_CHAT_VIBE_KEY } from './maia-ai-global.js'
import { MAIADB_LAYER_STACK_ICON_SVG } from './maia-icons.js'
import {
	escapeHtml,
	getProfileAvatarHtml,
	getSyncStatusMessage,
	truncate,
	truncateWords,
} from './utils.js'

/** Dashboard card icon for The Game (gamepad) */
const DASHBOARD_GAME_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m10.667 6.134l-.502-.355A4.24 4.24 0 0 0 7.715 5h-.612c-.405 0-.813.025-1.194.16c-2.383.846-4.022 3.935-3.903 10.943c.024 1.412.354 2.972 1.628 3.581A3.2 3.2 0 0 0 5.027 20a2.74 2.74 0 0 0 1.53-.437c.41-.268.77-.616 1.13-.964c.444-.43.888-.86 1.424-1.138a4.1 4.1 0 0 1 1.89-.461H13c.658 0 1.306.158 1.89.46c.536.279.98.709 1.425 1.139c.36.348.72.696 1.128.964c.39.256.895.437 1.531.437a3.2 3.2 0 0 0 1.393-.316c1.274-.609 1.604-2.17 1.628-3.581c.119-7.008-1.52-10.097-3.903-10.942C17.71 5.025 17.3 5 16.897 5h-.612a4.24 4.24 0 0 0-2.45.78l-.502.354a2.31 2.31 0 0 1-2.666 0" opacity="0.5"/><path fill="currentColor" d="M16.75 9a.75.75 0 1 1 0 1.5a.75.75 0 0 1 0-1.5m-9.25.25a.75.75 0 0 1 .75.75v.75H9a.75.75 0 0 1 0 1.5h-.75V13a.75.75 0 0 1-1.5 0v-.75H6a.75.75 0 0 1 0-1.5h.75V10a.75.75 0 0 1 .75-.75m11.5 2a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m-3.75.75a.75.75 0 1 0 0-1.5a.75.75 0 0 0 0 1.5m2.25.75a.75.75 0 1 0-1.5 0a.75.75 0 0 0 1.5 0"/></svg>`

/** Profile / avatar vibe (user silhouette) */
const DASHBOARD_PROFILE_VIBE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 256 256" aria-hidden="true"><g fill="currentColor"><path d="M192 96a64 64 0 1 1-64-64a64 64 0 0 1 64 64" opacity="0.2"/><path d="M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 1 0-73.66 0c-27.39 8.94-50.86 27.82-66.09 54.16a8 8 0 1 0 13.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1 0 13.85-8M72 96a56 56 0 1 1 56 56a56.06 56.06 0 0 1-56-56"/></g></svg>`

/** Sparks vibe (overlapping circles) */
const DASHBOARD_SPARKS_VIBE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 8A6 6 0 1 1 6 8a6 6 0 0 1 12 0"/><path fill="currentColor" d="M13.58 13.79a6 6 0 0 1-7.16-3.58a6 6 0 1 0 7.16 3.58" opacity="0.7"/><path fill="currentColor" d="M13.58 13.79c.271.684.42 1.43.42 2.21a6 6 0 0 1-2 4.472a6 6 0 1 0 5.58-10.262a6.01 6.01 0 0 1-4 3.58" opacity="0.4"/></svg>`

/** Docs / paper vibe (notebook / document) */
const DASHBOARD_DOCS_VIBE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.727 2.733c.306-.308.734-.508 1.544-.618C7.105 2.002 8.209 2 9.793 2h4.414c1.584 0 2.688.002 3.522.115c.81.11 1.238.31 1.544.618c.305.308.504.74.613 1.557c.112.84.114 1.955.114 3.552V18H7.426c-1.084 0-1.462.006-1.753.068c-.513.11-.96.347-1.285.667c-.11.108-.164.161-.291.505A1.3 1.3 0 0 0 4 19.7V7.842c0-1.597.002-2.711.114-3.552c.109-.816.308-1.249.613-1.557" opacity="0.5"/><path fill="currentColor" d="M20 18H7.426c-1.084 0-1.462.006-1.753.068c-.513.11-.96.347-1.285.667c-.11.108-.164.161-.291.505s-.107.489-.066.78l.022.15c.11.653.31.998.616 1.244c.307.246.737.407 1.55.494c.837.09 1.946.092 3.536.092h4.43c1.59 0 2.7-.001 3.536-.092c.813-.087 1.243-.248 1.55-.494c.2-.16.354-.362.467-.664H8a.75.75 0 0 1 0-1.5h11.975c.018-.363.023-.776.025-1.25M7.25 7A.75.75 0 0 1 8 6.25h8a.75.75 0 0 1 0 1.5H8A.75.75 0 0 1 7.25 7M8 9.75a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5z"/></svg>`

/** Todos vibe (stacked list rows) */
const DASHBOARD_TODOS_VIBE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 13h12c1.886 0 2.828 0 3.414.586S22 15.114 22 17s0 2.828-.586 3.414S19.886 21 18 21H6c-1.886 0-2.828 0-3.414-.586S2 18.886 2 17s0-2.828.586-3.414S4.114 13 6 13M6 3h12c1.886 0 2.828 0 3.414.586S22 5.114 22 7s0 2.828-.586 3.414S19.886 11 18 11H6c-1.886 0-2.828 0-3.414-.586S2 8.886 2 7s0-2.828.586-3.414S4.114 3 6 3" opacity="0.5"/><path fill="currentColor" d="M10.25 7a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75m-5 0A.75.75 0 0 1 6 6.25h2a.75.75 0 0 1 0 1.5H6A.75.75 0 0 1 5.25 7m5 10a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75m-5 0a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75"/></svg>`

/** Registries vibe (humans / addressbook — grid of nodes) */
const DASHBOARD_REGISTRIES_VIBE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><g fill="none"><path fill="currentColor" fill-opacity="0.16" d="M5 14a2 2 0 1 0 0-4a2 2 0 0 0 0 4m7-7a2 2 0 1 0 0-4a2 2 0 0 0 0 4m7 14a2 2 0 1 0 0-4a2 2 0 0 0 0 4"/><path stroke="currentColor" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="M12 14a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm-7 0a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm-7-7a2 2 0 1 0 0-4a2 2 0 0 0 0 4ZM5 7a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm-7 14a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm-7 0a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z"/></g></svg>`

/** Logs vibe (lines + sort / expand chevron) */
const DASHBOARD_LOGS_VIBE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M2.25 6A.75.75 0 0 1 3 5.25h18a.75.75 0 0 1 0 1.5H3A.75.75 0 0 1 2.25 6m0 4A.75.75 0 0 1 3 9.25h18a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1-.75-.75m0 4a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1-.75-.75m0 4a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1-.75-.75" clip-rule="evenodd" opacity="0.5"/><path fill="currentColor" d="M17.012 14.43a.75.75 0 0 1 .976 0l3.5 3a.75.75 0 1 1-.976 1.14L17.5 15.987l-3.012 2.581a.75.75 0 1 1-.976-1.138z"/></svg>`

const DEFAULT_VIBE_CARD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 256 256" aria-hidden="true"><g fill="currentColor"><path d="M224 128a96 96 0 1 1-96-96a96 96 0 0 1 96 96" opacity="0.2"/><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88"/></g></svg>`

function dashboardVibeCardIconSvg(vibeKey) {
	if (vibeKey === 'profile') return DASHBOARD_PROFILE_VIBE_ICON_SVG
	if (vibeKey === 'sparks') return DASHBOARD_SPARKS_VIBE_ICON_SVG
	if (vibeKey === 'paper') return DASHBOARD_DOCS_VIBE_ICON_SVG
	if (vibeKey === 'todos') return DASHBOARD_TODOS_VIBE_ICON_SVG
	if (vibeKey === 'registries') return DASHBOARD_REGISTRIES_VIBE_ICON_SVG
	if (vibeKey === 'logs') return DASHBOARD_LOGS_VIBE_ICON_SVG
	return DEFAULT_VIBE_CARD_ICON_SVG
}

/** Navbar icon for vibe viewer — same artwork as dashboard cards (plus Maia DB stack for `db`). */
function vibeViewerHeaderIconSvg(vibeKey) {
	if (!vibeKey) return DEFAULT_VIBE_CARD_ICON_SVG
	if (vibeKey === 'db') return MAIADB_LAYER_STACK_ICON_SVG
	return dashboardVibeCardIconSvg(vibeKey)
}

/**
 * Get spark display name from spark co-id (reads spark CoMap)
 */
async function getSparkDisplayName(maia, sparkCoId) {
	try {
		const sparkStore = await maia.do({ op: 'read', factory: null, key: sparkCoId })
		const sparkData = sparkStore?.value ?? sparkStore
		const name = sparkData?.name
		if (!name) return null
		// ° or @ prefix: use as-is. Otherwise prefix with °
		if (name.startsWith('°') || name.startsWith('@')) return name
		return `°${name}`
	} catch {
		return null
	}
}

/**
 * Load available sparks (context scopes) from account.registries.sparks
 * @param {Object} maia - MaiaOS instance
 * @returns {Promise<Array>} Array of spark objects with {key, name, description}
 */
async function loadSparksFromAccount(maia) {
	const sparks = []

	if (!maia) return sparks

	try {
		const account = maia.id.maiaId
		const accountStore = await maia.do({ op: 'read', factory: '@account', key: account.id })
		const accountData = accountStore.value || accountStore

		const registriesId = accountData?.registries
		if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_')) {
			return sparks
		}
		const registriesStore = await maia.do({ op: 'read', factory: null, key: registriesId })
		const registriesData = registriesStore.value || registriesStore
		const sparksId = registriesData.sparks
		if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_')) {
			return sparks
		}

		const sparksStore = await maia.do({ op: 'read', factory: sparksId, key: sparksId })
		const sparksData = sparksStore.value || sparksStore

		if (!sparksData || typeof sparksData !== 'object' || Array.isArray(sparksData)) return sparks

		const sparkKeys = Object.keys(sparksData).filter(
			(k) =>
				k !== 'id' &&
				k !== 'loading' &&
				k !== 'error' &&
				k !== '$schema' &&
				k !== 'type' &&
				typeof sparksData[k] === 'string' &&
				sparksData[k].startsWith('co_'),
		)

		const sparkResults = await Promise.all(
			sparkKeys.map(async (key) => {
				const coId = sparksData[key]
				const displayName = (await getSparkDisplayName(maia, coId)) || key
				return {
					key,
					name: displayName,
					description: `Context scope for ${displayName}`,
				}
			}),
		)
		sparks.push(...sparkResults)
	} catch (_error) {}
	return sparks
}

/**
 * Load vibes from spark.os.vibes registry.
 * Dynamic vibes: name and description from CoJSON (vibe manifest CoValue).
 * @param {Object} maia - MaiaOS instance
 * @param {string} spark - Spark name (e.g. '°Maia')
 * @returns {Promise<Array>} Array of vibe objects with {key, name, description, coId}
 */
async function loadVibesFromSpark(maia, spark) {
	const vibes = []
	if (!maia || !spark) return vibes
	try {
		const accountStore = await maia.do({ op: 'read', factory: '@account', key: maia.id.maiaId.id })
		const accountData = accountStore?.value ?? accountStore
		const registriesId = accountData?.registries
		if (typeof registriesId !== 'string' || !registriesId.startsWith('co_')) return vibes

		const registriesStore = await maia.do({ op: 'read', factory: null, key: registriesId })
		const registriesData = registriesStore?.value ?? registriesStore
		const sparksId = registriesData.sparks
		if (typeof sparksId !== 'string' || !sparksId.startsWith('co_')) return vibes

		const sparksStore = await maia.do({ op: 'read', factory: sparksId, key: sparksId })
		const sparksData = sparksStore?.value ?? sparksStore
		const sparkCoId = sparksData?.[spark]
		if (typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_')) return vibes

		const sparkStore = await maia.do({ op: 'read', factory: null, key: sparkCoId })
		const sparkData = sparkStore?.value ?? sparkStore
		const osId = sparkData?.os
		if (typeof osId !== 'string' || !osId.startsWith('co_')) return vibes

		const osStore = await maia.do({ op: 'read', factory: null, key: osId })
		const osData = osStore?.value ?? osStore
		const vibesId = osData?.vibes
		if (typeof vibesId !== 'string' || !vibesId.startsWith('co_')) return vibes

		const vibesStore = await maia.do({ op: 'read', factory: vibesId, key: vibesId })
		const vibesData = vibesStore?.value ?? vibesStore
		if (!vibesData || typeof vibesData !== 'object' || Array.isArray(vibesData)) return vibes

		const vibeKeys = Object.keys(vibesData).filter(
			(k) =>
				k !== 'id' &&
				k !== 'loading' &&
				k !== 'error' &&
				k !== '$schema' &&
				k !== '$factory' &&
				k !== 'type' &&
				!k.startsWith('$') &&
				typeof vibesData[k] === 'string' &&
				vibesData[k].startsWith('co_'),
		)

		// Read each vibe manifest from CoJSON for name/description (dynamic, no hardcoded fallbacks)
		const vibeEntries = await Promise.all(
			vibeKeys.map(async (vibeKey) => {
				const vibeCoId = vibesData[vibeKey]
				let name = `${vibeKey.charAt(0).toUpperCase() + vibeKey.slice(1)}`
				let description = `Open ${name}`
				try {
					const manifestStore = await maia.do({ op: 'read', factory: null, key: vibeCoId })
					const manifest = manifestStore?.value ?? manifestStore
					if (manifest?.name) name = manifest.name
					if (manifest?.description) description = truncateWords(manifest.description, 10)
				} catch (_e) {}
				return { key: vibeKey, name, description, coId: vibeCoId }
			}),
		)
		vibes.push(...vibeEntries)
	} catch (_error) {}
	return vibes
}

/**
 * Load vibes from all sparks and merge into one flat list.
 * @param {Object} maia - MaiaOS instance
 * @param {Array} sparks - Array of {key} from loadSparksFromAccount
 * @returns {Promise<Array>} Array of vibe objects with {key, name, description, coId, spark}
 */
async function loadVibesFromAllSparks(maia, sparks) {
	const all = []
	for (const spark of sparks) {
		const vibes = await loadVibesFromSpark(maia, spark.key)
		for (const v of vibes) {
			all.push({ ...v, spark: spark.key })
		}
	}
	return all
}

/**
 * Render dashboard screen - flat grid: MaiaDB + dynamic vibes (no sparks/avens hierarchy)
 */
export async function renderDashboard(
	maia,
	authState,
	syncState,
	_navigateToScreen,
	_currentSpark,
	_loadSpark,
	_loadVibe,
) {
	// Require signed-in account (maia.id = { maiaId, node })
	if (!maia?.id?.maiaId || !maia.id.node) {
		const isLoading = authState?.signedIn
		const message = isLoading ? 'Loading account…' : 'Please sign in.'
		document.getElementById('app').innerHTML = `
			<div class="loading-connecting-overlay">
				${isLoading ? '<div class="loading-spinner"></div>' : ''}
				<div class="loading-connecting-content">
					<h2>${message}</h2>
					${isLoading ? '<div class="loading-connecting-subtitle">Setting up your sovereign self…</div>' : ''}
				</div>
			</div>
		`
		return
	}

	const accountId = maia?.id?.maiaId?.id || ''
	let accountDisplayName = truncate(accountId, 12)
	let accountAvatarHtml = ''
	let sparks = []
	let vibes = []

	try {
		const [profilesResult, sparksResult] = await Promise.all([
			accountId?.startsWith('co_z') && maia?.do
				? resolveAccountCoIdsToProfiles(maia, [accountId])
				: Promise.resolve(new Map()),
			loadSparksFromAccount(maia),
		])
		sparks = sparksResult
		vibes = (await loadVibesFromAllSparks(maia, sparks)).filter((v) => v.key !== 'chat')
		const accountProfile = profilesResult.get(accountId) ?? null
		accountDisplayName = accountProfile?.name ?? accountDisplayName
		accountAvatarHtml = getProfileAvatarHtml(accountProfile?.image, {
			size: 44,
			className: 'navbar-avatar',
			syncState,
		})
	} catch (_e) {}
	if (accountId && !accountAvatarHtml) {
		accountAvatarHtml = getProfileAvatarHtml(null, { size: 44, className: 'navbar-avatar' })
	}

	const dbViewerCard = `
		<div class="dashboard-card whitish-card" onclick="window.navigateToScreen('maia-db')">
			<div class="dashboard-card-content">
				<div class="dashboard-card-icon">
					${MAIADB_LAYER_STACK_ICON_SVG}
				</div>
				<h3 class="dashboard-card-title">MaiaDB</h3>
				<p class="dashboard-card-description">Explore and inspect your data</p>
			</div>
		</div>
	`
	const gameCard = `
		<div class="dashboard-card whitish-card" onclick="window.navigateToScreen('the-game')">
			<div class="dashboard-card-content">
				<div class="dashboard-card-icon">
					${DASHBOARD_GAME_ICON_SVG}
				</div>
				<h3 class="dashboard-card-title">The Game</h3>
				<p class="dashboard-card-description">Explore Maia City in 3D</p>
			</div>
		</div>
	`
	const vibeCards = vibes
		.map(
			(vibe) => `
		<div class="dashboard-card whitish-card" onclick="window.loadVibeWithSpark('${escapeHtml(vibe.key)}', '${escapeHtml(vibe.spark || '°Maia')}')">
			<div class="dashboard-card-content">
				<div class="dashboard-card-icon">
					${dashboardVibeCardIconSvg(vibe.key)}
				</div>
				<h3 class="dashboard-card-title">${escapeHtml(vibe.name)}</h3>
				<p class="dashboard-card-description">${escapeHtml(vibe.description)}</p>
			</div>
		</div>
	`,
		)
		.join('')

	const cards = dbViewerCard + gameCard + vibeCards

	// Reactivity: when vibes empty, retry render so dashboard updates when registries/sparks/vibes arrive
	if (vibes.length === 0 && vibeCards === '' && typeof window.renderAppInternal === 'function') {
		setTimeout(() => window.renderAppInternal(), 1500)
		setTimeout(() => window.renderAppInternal(), 3500)
	}

	const headerTitle = 'Me'

	document.getElementById('app').innerHTML = `
		<div class="db-container">
			<div class="navbar-section">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>${escapeHtml(headerTitle)}</h1>
					</div>
					<div class="header-center">
						<!-- Logo centered in navbar -->
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						${
							authState.signedIn
								? `
							${accountAvatarHtml ? `<div class="account-nav-group"><span class="account-display-name">${escapeHtml(accountDisplayName)}</span><button type="button" class="db-status account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${accountAvatarHtml}</button></div>` : `<button type="button" class="db-status db-status-name account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>`}
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
						<div class="mobile-menu-account-info">
							<span class="mobile-menu-account-name">${escapeHtml(accountDisplayName)}</span>
							<div class="mobile-menu-account-id-row">
								<button type="button" class="mobile-menu-copy-id" title="Copy ID" data-copy-id="${escapeHtml(accountId)}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button>
								<code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</code>
							</div>
						</div>
					</div>
				`
						: ''
				}
				${
					authState.signedIn
						? `
					<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">
						Sign Out
					</button>
				`
						: ''
				}
			</div>
			</div>

			<div class="dashboard-main">
				<div class="dashboard-grid">
					${cards || `<div class="empty-state p-12 text-center text-slate-400 italic">No context scopes available</div>`}
				</div>
			</div>
		</div>
	`
}

/**
 * Render aven viewer screen (full-screen aven display)
 * @param {string} [currentSpark='°Maia'] - Spark context scope for avens
 */
export async function renderVibeViewer(
	maia,
	authState,
	syncState,
	currentVibe,
	_navigateToScreen,
	currentSpark = '°Maia',
) {
	const perf = createPerfTracer('app', 'vibes')
	perf.start(`renderVibeViewer:${currentVibe}`)
	try {
		const accountId = maia?.id?.maiaId?.id || ''
		let accountDisplayName = truncate(accountId, 12)
		let accountAvatarHtml = ''
		if (accountId?.startsWith('co_z') && maia?.do) {
			try {
				await perf.measure('resolveAccountProfile', async () => {
					const profiles = await resolveAccountCoIdsToProfiles(maia, [accountId])
					const accountProfile = profiles.get(accountId) ?? null
					accountDisplayName = accountProfile?.name ?? accountDisplayName
					accountAvatarHtml = getProfileAvatarHtml(accountProfile?.image, {
						size: 44,
						className: 'navbar-avatar',
						syncState,
					})
				})
			} catch (_e) {}
		}
		if (accountId && !accountAvatarHtml) {
			accountAvatarHtml = getProfileAvatarHtml(null, { size: 44, className: 'navbar-avatar' })
		}
		perf.step('profile+avatar')
		// Dvibes (special screens): hardcoded names. Dynamic vibes: resolved from registry manifest.
		const dvibeNameMap = { db: 'MaiaDB' }
		let vibeLabel = 'Vibe'
		if (currentVibe) {
			if (dvibeNameMap[currentVibe]) {
				vibeLabel = dvibeNameMap[currentVibe]
			} else {
				await perf.measure('getAllVibeRegistries+vibeLabel', async () => {
					const registries = await getAllVibeRegistries()
					const reg = registries.find((r) => r?.vibe?.$id === `°Maia/vibe/${currentVibe}`)
					vibeLabel = reg?.vibe?.name ?? `${currentVibe.charAt(0).toUpperCase() + currentVibe.slice(1)}`
				})
			}
		}
		perf.step('vibeTitle')

		// Park persistent Chat intent off-screen so destroyActorsForContainer does not tear down the tree
		if (maia?.runtime) {
			await perf.measure('chatIntentReuse', async () => {
				const intentId = findSessionChatIntentActorId(maia)
				if (intentId) {
					let host = document.getElementById('maia-session-chat-host')
					if (!host) {
						host = document.createElement('div')
						host.id = 'maia-session-chat-host'
						host.setAttribute('aria-hidden', 'true')
						host.style.cssText =
							'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;visibility:hidden'
						document.body.appendChild(host)
					}
					try {
						await maia.getEngines().actorEngine.reuseActor(intentId, host, PERSISTENT_CHAT_VIBE_KEY)
					} catch (_e) {}
				}
			})
		}
		perf.step('afterChatHost')

		// Clear any existing vibe containers before rendering new one
		// This ensures we don't have multiple aven containers stacked
		const app = document.getElementById('app')
		if (app) {
			const existingContainers = app.querySelectorAll('.vibe-container')
			for (const container of existingContainers) {
				if (maia?.runtime) maia.runtime.destroyActorsForContainer(container)
				container.remove()
			}
		}
		perf.step('destroyOldContainers')

		app.innerHTML = `
		<div class="db-container">
			<div class="navbar-section">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<span class="db-header-maia-icon" aria-hidden="true">${vibeViewerHeaderIconSvg(currentVibe)}</span>
						<h1>${escapeHtml(vibeLabel)}</h1>
					</div>
					<div class="header-center">
						<!-- Logo centered in navbar -->
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						${
							authState.signedIn
								? `
							${accountAvatarHtml ? `<div class="account-nav-group"><span class="account-display-name">${escapeHtml(accountDisplayName)}</span><button type="button" class="db-status account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${accountAvatarHtml}</button></div>` : `<button type="button" class="db-status db-status-name account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>`}
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
						<div class="mobile-menu-account-info">
							<span class="mobile-menu-account-name">${escapeHtml(accountDisplayName)}</span>
							<div class="mobile-menu-account-id-row">
								<button type="button" class="mobile-menu-copy-id" title="Copy ID" data-copy-id="${escapeHtml(accountId)}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button>
								<code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</code>
							</div>
						</div>
					</div>
				`
						: ''
				}
				${
					authState.signedIn
						? `
					<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">
						Sign Out
					</button>
				`
						: ''
				}
			</div>
			</div>

			<div class="vibe-viewer-main">
				<div class="vibe-card">
					<div id="vibe-container-${escapeHtml(currentVibe)}" class="vibe-container"></div>
				</div>
			</div>
		</div>
	`
		perf.step('shellDOM')

		// Add sidebar toggle handlers for maiadb vibe
		setTimeout(() => {
			const vibeContainer = document.querySelector('.vibe-container')
			if (vibeContainer?.shadowRoot) {
				const navAside = vibeContainer.shadowRoot.querySelector('.nav-aside')
				const detailAside = vibeContainer.shadowRoot.querySelector('.detail-aside')

				// Start collapsed by default, no transitions
				if (navAside) {
					navAside.classList.add('collapsed')
				}
				if (detailAside) {
					detailAside.classList.add('collapsed')
				}

				// Add toggle handlers
				const navToggle = vibeContainer.shadowRoot.querySelector('.nav-toggle')
				const detailToggle = vibeContainer.shadowRoot.querySelector('.detail-toggle')

				if (navToggle) {
					navToggle.addEventListener('click', () => {
						if (navAside) {
							// Enable transitions when user explicitly toggles
							navAside.classList.add('sidebar-ready')
							navAside.classList.toggle('collapsed')
						}
					})
				}

				if (detailToggle) {
					detailToggle.addEventListener('click', () => {
						if (detailAside) {
							// Enable transitions when user explicitly toggles
							detailAside.classList.add('sidebar-ready')
							detailAside.classList.toggle('collapsed')
						}
					})
				}
			}
		}, 100)

		// Await rAF + loadVibeFromAccount so loadVibe/renderApp timing includes real mount (was fire-and-forget).
		await new Promise((resolve, reject) => {
			requestAnimationFrame(() => {
				void (async () => {
					try {
						await new Promise((r) => setTimeout(r, 10))
						perf.step('rAF+10ms')

						const allContainers = document.querySelectorAll('.vibe-container')
						if (allContainers.length > 1) {
							const targetContainer = document.getElementById(`vibe-container-${currentVibe}`)
							for (const container of allContainers) {
								if (container !== targetContainer) {
									container.remove()
								}
							}
						}

						const container = document.getElementById(`vibe-container-${currentVibe}`)
						if (!container || !maia) {
							resolve()
							return
						}

						container.innerHTML = ''
						perf.step('beforeLoadVibeFromAccount')

						if (currentVibe === 'chat') {
							const intentId = findSessionChatIntentActorId(maia)
							if (intentId) {
								await perf.measure('loadVibeFromAccount(chat reuse)', async () =>
									maia.getEngines().actorEngine.reuseActor(intentId, container, PERSISTENT_CHAT_VIBE_KEY),
								)
							} else {
								await perf.measure('loadVibeFromAccount(chat)', async () =>
									maia.loadVibeFromAccount(
										'chat',
										container,
										currentSpark || '°Maia',
										PERSISTENT_CHAT_VIBE_KEY,
									),
								)
							}
						} else {
							await perf.measure('loadVibeFromAccount', async () =>
								maia.loadVibeFromAccount(currentVibe, container, currentSpark || '°Maia'),
							)
						}
						perf.step('afterLoadVibeFromAccount')

						setTimeout(() => {
							const vibeContainerEl = document.getElementById(`vibe-container-${currentVibe}`)
							if (vibeContainerEl) {
								const shadowRoot = vibeContainerEl.shadowRoot || vibeContainerEl
								const navToggle = shadowRoot.querySelector('.nav-toggle')
								const detailToggle = shadowRoot.querySelector('.detail-toggle')

								if (navToggle) {
									navToggle.addEventListener('click', () => {
										const navAside = navToggle.closest('.nav-aside')
										if (navAside) {
											navAside.classList.toggle('collapsed')
										}
									})
								}

								if (detailToggle) {
									detailToggle.addEventListener('click', () => {
										const detailAside = detailToggle.closest('.detail-aside')
										if (detailAside) {
											detailAside.classList.toggle('collapsed')
										}
									})
								}
							}
						}, 500)

						window.currentVibeContainer = container
						resolve()
					} catch (error) {
						const container = document.getElementById(`vibe-container-${currentVibe}`)
						if (container) {
							container.innerHTML = `<div class="empty-state p-8 text-center text-rose-500 font-medium bg-rose-50/50 rounded-2xl border border-rose-100">Error loading aven: ${escapeHtml(error.message)}</div>`
						}
						reject(error)
					}
				})()
			})
		})

		perf.end('renderVibeViewer')
	} catch (e) {
		perf.end('renderVibeViewer(error)')
		throw e
	}
}
