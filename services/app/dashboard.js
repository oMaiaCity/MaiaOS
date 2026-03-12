/**
 * Dashboard and Vibe Viewer Rendering
 * Handles dashboard screen and aven viewer rendering
 */

import { getAllAvenRegistries, resolveAccountCoIdsToProfiles } from '@MaiaOS/loader'
import {
	escapeHtml,
	getProfileAvatarHtml,
	getSyncStatusMessage,
	truncate,
	truncateWords,
} from './utils.js'

/**
 * Extract aven key from aven $id (e.g., "°Maia/aven/todos" -> "todos")
 */
function getAvenKeyFromId(avenId) {
	if (!avenId) return null
	if (avenId.startsWith('°Maia/aven/')) {
		return avenId.replace('°Maia/aven/', '')
	}
	return null
}

/**
 * Get spark display name from spark co-id (reads spark CoMap)
 */
async function getSparkDisplayName(maia, sparkCoId) {
	try {
		const sparkStore = await maia.do({ op: 'read', schema: null, key: sparkCoId })
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
		const accountStore = await maia.do({ op: 'read', schema: '@account', key: account.id })
		const accountData = accountStore.value || accountStore

		const registriesId = accountData?.registries
		if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_')) {
			return sparks
		}
		const registriesStore = await maia.do({ op: 'read', schema: null, key: registriesId })
		const registriesData = registriesStore.value || registriesStore
		const sparksId = registriesData.sparks
		if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_')) {
			return sparks
		}

		const sparksStore = await maia.do({ op: 'read', schema: sparksId, key: sparksId })
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

		for (const key of sparkKeys) {
			// Resolve display name from spark CoMap (key → co-id, co-id → name)
			const coId = sparksData[key]
			const displayName = (await getSparkDisplayName(maia, coId)) || key
			sparks.push({
				key,
				name: displayName,
				description: `Context scope for ${displayName}`,
			})
		}
	} catch (_error) {}
	return sparks
}

/**
 * Load avens from spark.avens registry
 * @param {Object} maia - MaiaOS instance
 * @param {string} spark - Spark name (e.g. '°Maia')
 * @returns {Promise<Array>} Array of aven objects with {key, name, description, coId}
 */
async function loadAvensFromSpark(maia, spark) {
	const avens = []
	if (!maia || !spark) return avens
	try {
		const avenRegistries = await getAllAvenRegistries()
		const manifestMap = new Map()
		for (const registry of avenRegistries) {
			if (registry.aven) {
				const avenKey = getAvenKeyFromId(registry.aven.$id)
				if (avenKey)
					manifestMap.set(avenKey, {
						name: registry.aven.name || avenKey,
						description: registry.aven.description || '',
					})
			}
		}

		const accountStore = await maia.do({ op: 'read', schema: '@account', key: maia.id.maiaId.id })
		const accountData = accountStore?.value ?? accountStore
		const registriesId = accountData?.registries
		if (typeof registriesId !== 'string' || !registriesId.startsWith('co_')) return avens

		const registriesStore = await maia.do({ op: 'read', schema: null, key: registriesId })
		const registriesData = registriesStore?.value ?? registriesStore
		const sparksId = registriesData.sparks
		if (typeof sparksId !== 'string' || !sparksId.startsWith('co_')) return avens

		const sparksStore = await maia.do({ op: 'read', schema: sparksId, key: sparksId })
		const sparksData = sparksStore?.value ?? sparksStore
		const sparkCoId = sparksData?.[spark]
		if (typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_')) return avens

		const sparkStore = await maia.do({ op: 'read', schema: null, key: sparkCoId })
		const sparkData = sparkStore?.value ?? sparkStore
		const avensId = sparkData?.avens
		if (typeof avensId !== 'string' || !avensId.startsWith('co_')) return avens

		const avensStore = await maia.do({ op: 'read', schema: avensId, key: avensId })
		const avensData = avensStore?.value ?? avensStore
		if (!avensData || typeof avensData !== 'object' || Array.isArray(avensData)) return avens

		const avenKeys = Object.keys(avensData).filter(
			(k) =>
				k !== 'id' &&
				k !== 'loading' &&
				k !== 'error' &&
				k !== '$schema' &&
				k !== 'type' &&
				typeof avensData[k] === 'string' &&
				avensData[k].startsWith('co_'),
		)

		// Display name overrides: aven key -> user-facing label (e.g. logs -> Creator)
		const avenDisplayNameOverrides = { logs: 'Creator' }
		for (const avenKey of avenKeys) {
			const avenCoId = avensData[avenKey]
			const manifest = manifestMap.get(avenKey)
			const name =
				avenDisplayNameOverrides[avenKey] ??
				manifest?.name ??
				`${avenKey.charAt(0).toUpperCase() + avenKey.slice(1)}`
			const description = manifest?.description
				? truncateWords(manifest.description, 10)
				: `Open ${name}`
			avens.push({
				key: avenKey,
				name,
				description,
				coId: avenCoId,
			})
		}
	} catch (_error) {}
	return avens
}

/**
 * Render dashboard screen with grid context hierarchy
 * Level 1: Sparks (context scopes) + DB Viewer
 * Level 2: Avens for selected spark (when currentSpark is set)
 */
export async function renderDashboard(
	maia,
	authState,
	syncState,
	_navigateToScreen,
	currentSpark,
	_loadSpark,
	_loadAven,
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
	if (accountId?.startsWith('co_z') && maia?.do) {
		try {
			const profiles = await resolveAccountCoIdsToProfiles(maia, [accountId])
			const accountProfile = profiles.get(accountId) ?? null
			accountDisplayName = accountProfile?.name ?? accountDisplayName
			accountAvatarHtml = getProfileAvatarHtml(accountProfile?.image, {
				size: 44,
				className: 'navbar-avatar',
				syncState,
			})
		} catch (_e) {}
	}
	if (accountId && !accountAvatarHtml) {
		accountAvatarHtml = getProfileAvatarHtml(null, { size: 44, className: 'navbar-avatar' })
	}

	let cards = ''

	if (!currentSpark) {
		// Level 1: Show sparks (context scopes) + DB Viewer (hardcoded CoJSON inspector)
		const sparks = await loadSparksFromAccount(maia)

		const dbViewerCard = `
			<div class="dashboard-card whitish-card" onclick="window.navigateToScreen('maia-db')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M4 7h16M4 12h16M4 17h16"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">MaiaDB</h3>
					<p class="dashboard-card-description">Explore and inspect your data</p>
				</div>
			</div>
		`
		const maiaAICard = `
			<div class="dashboard-card whitish-card" onclick="window.navigateToScreen('maia-ai')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M12 2a2 2 0 0 0-2 2c0 .74.4 1.39 1 1.73V7h2V5.73c.6-.34 1-.99 1-1.73a2 2 0 0 0-2-2z"/>
							<path d="M15 10h-6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3z"/>
							<path d="M10 14l1.5 1.5L14 13"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">Maia AI</h3>
					<p class="dashboard-card-description">On-device chat & voice</p>
				</div>
			</div>
		`
		const sparkCards = sparks
			.map(
				(spark) => `
			<div class="dashboard-card whitish-card" onclick="window.loadSpark('${escapeHtml(spark.key)}')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M13 10V3L4 14h7v7l9-11h-7z"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">${escapeHtml(spark.name)}</h3>
					<p class="dashboard-card-description">${escapeHtml(spark.description)}</p>
				</div>
			</div>
		`,
			)
			.join('')

		cards = dbViewerCard + maiaAICard + sparkCards
	} else {
		// Level 2: Show avens for the selected spark (no back card - Switch Spark in bottom navbar)
		const avens = await loadAvensFromSpark(maia, currentSpark)

		const avenCards = avens
			.map(
				(aven) => `
			<div class="dashboard-card whitish-card" onclick="window.loadAven('${escapeHtml(aven.key)}')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">${escapeHtml(aven.name)}</h3>
					<p class="dashboard-card-description">${escapeHtml(aven.description)}</p>
				</div>
			</div>
		`,
			)
			.join('')

		cards = avenCards

		// Reactivity: when avens empty but spark selected, retry render so dashboard updates when registries/sparks/avens arrive.
		if (currentSpark && avenCards === '' && typeof window.renderAppInternal === 'function') {
			setTimeout(() => window.renderAppInternal(), 1500)
			setTimeout(() => window.renderAppInternal(), 3500)
		}
	}

	const headerTitle = currentSpark ? `${currentSpark} Avens` : 'Me'

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

			<div class="dashboard-main ${currentSpark ? 'has-bottom-navbar' : ''}">
				<div class="dashboard-grid">
					${cards || `<div class="empty-state p-12 text-center text-slate-400 italic">${currentSpark ? 'No avens in this context' : 'No context scopes available'}</div>`}
				</div>
			</div>
			${
				currentSpark
					? `
			<!-- Bottom navbar - Switch Spark (same position as Home in aven viewer) -->
			<div class="bottom-navbar">
				<div class="bottom-navbar-left"></div>
				<div class="bottom-navbar-center">
					<button class="home-btn bottom-home-btn" onclick="window.loadSpark(null)" title="Switch Spark">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M13 10V3L4 14h7v7l9-11h-7z"/>
						</svg>
						<span class="home-label">Switch Spark</span>
					</button>
				</div>
				<div class="bottom-navbar-right"></div>
			</div>
			`
					: ''
			}
		</div>
	`
}

/**
 * Render aven viewer screen (full-screen aven display)
 * @param {string} [currentSpark='°Maia'] - Spark context scope for avens
 */
export async function renderAvenViewer(
	maia,
	authState,
	syncState,
	currentAven,
	_navigateToScreen,
	currentSpark = '°Maia',
) {
	const accountId = maia?.id?.maiaId?.id || ''
	let accountDisplayName = truncate(accountId, 12)
	let accountAvatarHtml = ''
	if (accountId?.startsWith('co_z') && maia?.do) {
		try {
			const profiles = await resolveAccountCoIdsToProfiles(maia, [accountId])
			const accountProfile = profiles.get(accountId) ?? null
			accountDisplayName = accountProfile?.name ?? accountDisplayName
			accountAvatarHtml = getProfileAvatarHtml(accountProfile?.image, {
				size: 44,
				className: 'navbar-avatar',
				syncState,
			})
		} catch (_e) {}
	}
	if (accountId && !accountAvatarHtml) {
		accountAvatarHtml = getProfileAvatarHtml(null, { size: 44, className: 'navbar-avatar' })
	}
	// Map aven keys to display names
	const avenNameMap = {
		db: 'MaiaDB',
		humans: 'Addressbook',
		todos: 'Todos',
		logs: 'Creator',
	}
	const avenLabel = currentAven
		? avenNameMap[currentAven] || `${currentAven.charAt(0).toUpperCase() + currentAven.slice(1)}`
		: 'Aven'

	// Clear any existing aven containers before rendering new one
	// This ensures we don't have multiple aven containers stacked
	const app = document.getElementById('app')
	if (app) {
		const existingContainers = app.querySelectorAll('.aven-container')
		for (const container of existingContainers) {
			if (maia?.runtime) maia.runtime.destroyActorsForContainer(container)
			container.remove()
		}
	}

	app.innerHTML = `
		<div class="db-container">
			<div class="navbar-section">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>${escapeHtml(avenLabel)}</h1>
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

			<div class="aven-viewer-main">
				<div class="aven-card">
					<div id="aven-container-${escapeHtml(currentAven)}" class="aven-container"></div>
				</div>
				<!-- Bottom navbar area for mobile - home button bottom-left (vibe-specific buttons handled by vibes) -->
				<div class="bottom-navbar">
					<div class="bottom-navbar-left">
						<button class="home-btn bottom-home-btn home-btn-icon-only" onclick="window.loadVibe(null)" title="Home" aria-label="Home">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
								<polyline points="9 22 9 12 15 12 15 22"></polyline>
							</svg>
						</button>
					</div>
					<div class="bottom-navbar-center">
						<!-- Center reserved for vibe-specific -->
					</div>
					<div class="bottom-navbar-right">
						<!-- Right buttons are aven-specific, not global -->
					</div>
				</div>
			</div>
		</div>
	`

	// Add sidebar toggle handlers for maiadb aven
	setTimeout(() => {
		const avenContainer = document.querySelector('.aven-container')
		if (avenContainer?.shadowRoot) {
			const navAside = avenContainer.shadowRoot.querySelector('.nav-aside')
			const detailAside = avenContainer.shadowRoot.querySelector('.detail-aside')

			// Start collapsed by default, no transitions
			if (navAside) {
				navAside.classList.add('collapsed')
			}
			if (detailAside) {
				detailAside.classList.add('collapsed')
			}

			// Add toggle handlers
			const navToggle = avenContainer.shadowRoot.querySelector('.nav-toggle')
			const detailToggle = avenContainer.shadowRoot.querySelector('.detail-toggle')

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

	// Load aven asynchronously after DOM is updated
	requestAnimationFrame(async () => {
		try {
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Ensure only one aven container exists (cleanup any duplicates)
			const allContainers = document.querySelectorAll('.aven-container')
			if (allContainers.length > 1) {
				const targetContainer = document.getElementById(`aven-container-${currentAven}`)
				for (const container of allContainers) {
					if (container !== targetContainer) {
						container.remove()
					}
				}
			}

			const container = document.getElementById(`aven-container-${currentAven}`)
			if (!container) {
				return
			}
			if (!maia) {
				return
			}

			// Clear container before loading new aven (remove any existing content)
			container.innerHTML = ''

			// Load aven from spark context (registries.sparks[spark].avens)
			await maia.loadAvenFromAccount(currentAven, container, currentSpark || '°Maia')

			// Add sidebar toggle handlers for maiadb aven (after aven loads)
			setTimeout(() => {
				const avenContainerEl = document.getElementById(`aven-container-${currentAven}`)
				if (avenContainerEl) {
					const shadowRoot = avenContainerEl.shadowRoot || avenContainerEl
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

			// Store container reference for cleanup on unload
			window.currentAvenContainer = container
		} catch (error) {
			const container = document.getElementById(`aven-container-${currentAven}`)
			if (container) {
				container.innerHTML = `<div class="empty-state p-8 text-center text-rose-500 font-medium bg-rose-50/50 rounded-2xl border border-rose-100">Error loading aven: ${error.message}</div>`
			}
		}
	})
}
