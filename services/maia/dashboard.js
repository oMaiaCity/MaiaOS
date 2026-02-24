/**
 * Dashboard and Vibe Viewer Rendering
 * Handles dashboard screen and agent viewer rendering
 */

import { getAllAgentRegistries, resolveAccountCoIdsToProfileNames } from '@MaiaOS/loader'
import { escapeHtml, getSyncStatusMessage, truncate, truncateWords } from './utils.js'

/**
 * Extract agent key from agent $id (e.g., "°Maia/agent/todos" -> "todos")
 */
function getAgentKeyFromId(agentId) {
	if (!agentId) return null
	if (agentId.startsWith('°Maia/agent/')) {
		return agentId.replace('°Maia/agent/', '')
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
 * Load agents from spark.agents registry
 * @param {Object} maia - MaiaOS instance
 * @param {string} spark - Spark name (e.g. '°Maia')
 * @returns {Promise<Array>} Array of agent objects with {key, name, description, coId}
 */
async function loadAgentsFromSpark(maia, spark) {
	const agents = []
	if (!maia || !spark) return agents
	try {
		const agentRegistries = await getAllAgentRegistries()
		const manifestMap = new Map()
		for (const registry of agentRegistries) {
			if (registry.agent) {
				const agentKey = getAgentKeyFromId(registry.agent.$id)
				if (agentKey)
					manifestMap.set(agentKey, {
						name: registry.agent.name || agentKey,
						description: registry.agent.description || '',
					})
			}
		}

		const accountStore = await maia.do({ op: 'read', schema: '@account', key: maia.id.maiaId.id })
		const accountData = accountStore?.value ?? accountStore
		const registriesId = accountData?.registries
		if (typeof registriesId !== 'string' || !registriesId.startsWith('co_')) return agents

		const registriesStore = await maia.do({ op: 'read', schema: null, key: registriesId })
		const registriesData = registriesStore?.value ?? registriesStore
		const sparksId = registriesData.sparks
		if (typeof sparksId !== 'string' || !sparksId.startsWith('co_')) return agents

		const sparksStore = await maia.do({ op: 'read', schema: sparksId, key: sparksId })
		const sparksData = sparksStore?.value ?? sparksStore
		const sparkCoId = sparksData?.[spark]
		if (typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_')) return agents

		const sparkStore = await maia.do({ op: 'read', schema: null, key: sparkCoId })
		const sparkData = sparkStore?.value ?? sparkStore
		const agentsId = sparkData?.agents
		if (typeof agentsId !== 'string' || !agentsId.startsWith('co_')) return agents

		const agentsStore = await maia.do({ op: 'read', schema: agentsId, key: agentsId })
		const agentsData = agentsStore?.value ?? agentsStore
		if (!agentsData || typeof agentsData !== 'object' || Array.isArray(agentsData)) return agents

		const agentKeys = Object.keys(agentsData).filter(
			(k) =>
				k !== 'id' &&
				k !== 'loading' &&
				k !== 'error' &&
				k !== '$schema' &&
				k !== 'type' &&
				typeof agentsData[k] === 'string' &&
				agentsData[k].startsWith('co_'),
		)

		for (const agentKey of agentKeys) {
			const agentCoId = agentsData[agentKey]
			const manifest = manifestMap.get(agentKey)
			const name = manifest?.name || `${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)}`
			const description = manifest?.description
				? truncateWords(manifest.description, 10)
				: `Open ${name}`
			agents.push({
				key: agentKey,
				name,
				description,
				coId: agentCoId,
			})
		}
	} catch (_error) {}
	return agents
}

/**
 * Render dashboard screen with grid context hierarchy
 * Level 1: Sparks (context scopes) + DB Viewer
 * Level 2: Agents for selected spark (when currentSpark is set)
 */
export async function renderDashboard(
	maia,
	authState,
	syncState,
	_navigateToScreen,
	currentSpark,
	_loadSpark,
	_loadAgent,
) {
	// Require signed-in account (maia.id = { maiaId, node })
	if (!maia?.id?.maiaId || !maia.id.node) {
		document.getElementById('app').innerHTML = `
			<div class="flex flex-col justify-center items-center min-h-[60vh] text-slate-500">
				<p class="font-medium">${authState?.signedIn ? 'Loading account…' : 'Please sign in.'}</p>
			</div>
		`
		return
	}

	const accountId = maia?.id?.maiaId?.id || ''
	let accountDisplayName = truncate(accountId, 12)
	if (accountId?.startsWith('co_z') && maia?.db) {
		try {
			const profileNames = await resolveAccountCoIdsToProfileNames(maia, [accountId])
			accountDisplayName = profileNames.get(accountId) ?? accountDisplayName
		} catch (_e) {}
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
		const voiceCard = `
			<div class="dashboard-card whitish-card" onclick="window.navigateTo('/voice')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
							<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
							<line x1="12" y1="19" x2="12" y2="23"/>
							<line x1="8" y1="23" x2="16" y2="23"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">Voice</h3>
					<p class="dashboard-card-description">Real-time speech-to-text</p>
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

		cards = dbViewerCard + voiceCard + sparkCards
	} else {
		// Level 2: Show agents for the selected spark (no back card - Switch Spark in bottom navbar)
		const agents = await loadAgentsFromSpark(maia, currentSpark)

		const agentCards = agents
			.map(
				(agent) => `
			<div class="dashboard-card whitish-card" onclick="window.loadAgent('${escapeHtml(agent.key)}')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">${escapeHtml(agent.name)}</h3>
					<p class="dashboard-card-description">${escapeHtml(agent.description)}</p>
				</div>
			</div>
		`,
			)
			.join('')

		cards = agentCards

		// Reactivity: when agents empty but spark selected, retry render so dashboard updates when registries/sparks/agents arrive.
		if (currentSpark && agentCards === '' && typeof window.renderAppInternal === 'function') {
			setTimeout(() => window.renderAppInternal(), 1500)
			setTimeout(() => window.renderAppInternal(), 3500)
		}
	}

	const headerTitle = currentSpark ? `${currentSpark} Agents` : 'Me'

	document.getElementById('app').innerHTML = `
		<div class="db-container">
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
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}" title="${getSyncStatusMessage(syncState)}" aria-label="${getSyncStatusMessage(syncState)}">
							<span class="sync-dot"></span>
						</div>
						${
							authState.signedIn
								? `
							<button type="button" class="db-status db-status-name account-menu-toggle" title="Account: ${accountId}" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>
						`
								: ''
						}
					</div>
				</div>
				<!-- Mobile menu (collapsed by default) - account ID shown inside -->
				<div class="mobile-menu" id="mobile-menu">
					${
						authState.signedIn && accountId
							? `
						<div class="mobile-menu-account-id">
							<button type="button" class="mobile-menu-copy-id" title="Copy ID" data-copy-id="${escapeHtml(accountId)}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button>
							<code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</code>
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
			</header>

			<div class="dashboard-main ${currentSpark ? 'has-bottom-navbar' : ''}">
				<div class="dashboard-grid">
					${cards || `<div class="empty-state p-12 text-center text-slate-400 italic">${currentSpark ? 'No agents in this context' : 'No context scopes available'}</div>`}
				</div>
			</div>
			${
				currentSpark
					? `
			<!-- Bottom navbar - Switch Spark (same position as Home in agent viewer) -->
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
 * Render agent viewer screen (full-screen agent display)
 * @param {string} [currentSpark='°Maia'] - Spark context scope for agents
 */
export async function renderAgentViewer(
	maia,
	authState,
	syncState,
	currentAgent,
	_navigateToScreen,
	currentSpark = '°Maia',
) {
	const accountId = maia?.id?.maiaId?.id || ''
	let accountDisplayName = truncate(accountId, 12)
	if (accountId?.startsWith('co_z') && maia?.db) {
		try {
			const profileNames = await resolveAccountCoIdsToProfileNames(maia, [accountId])
			accountDisplayName = profileNames.get(accountId) ?? accountDisplayName
		} catch (_e) {}
	}
	// Map agent keys to display names
	const agentNameMap = {
		db: 'MaiaDB',
		humans: 'Human Book',
		todos: 'Todos',
		logs: 'Creator',
	}
	const agentLabel = currentAgent
		? agentNameMap[currentAgent] || `${currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1)}`
		: 'Agent'

	// Clear any existing agent containers before rendering new one
	// This ensures we don't have multiple agent containers stacked
	const app = document.getElementById('app')
	if (app) {
		const existingContainers = app.querySelectorAll('.agent-container')
		for (const container of existingContainers) {
			if (maia?.runtime) maia.runtime.destroyActorsForContainer(container)
			container.remove()
		}
	}

	app.innerHTML = `
		<div class="db-container">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>${escapeHtml(agentLabel)}</h1>
					</div>
					<div class="header-center">
						<!-- Logo centered in navbar -->
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}" title="${getSyncStatusMessage(syncState)}" aria-label="${getSyncStatusMessage(syncState)}">
							<span class="sync-dot"></span>
						</div>
						${
							authState.signedIn
								? `
							<button type="button" class="db-status db-status-name account-menu-toggle" title="Account: ${accountId}" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>
						`
								: ''
						}
					</div>
				</div>
				<!-- Mobile menu (collapsed by default) - account ID shown inside -->
				<div class="mobile-menu" id="mobile-menu">
					${
						authState.signedIn && accountId
							? `
						<div class="mobile-menu-account-id">
							<button type="button" class="mobile-menu-copy-id" title="Copy ID" data-copy-id="${escapeHtml(accountId)}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button>
							<code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</code>
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
			</header>

			<div class="agent-viewer-main">
				<div class="agent-card">
					<div id="agent-container-${escapeHtml(currentAgent)}" class="agent-container"></div>
				</div>
				<!-- Bottom navbar area for mobile - home button bottom-left (agent-specific buttons handled by agents) -->
				<div class="bottom-navbar">
					<div class="bottom-navbar-left">
						<button class="home-btn bottom-home-btn home-btn-icon-only" onclick="window.loadAgent(null)" title="Home" aria-label="Home">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
								<polyline points="9 22 9 12 15 12 15 22"></polyline>
							</svg>
						</button>
					</div>
					<div class="bottom-navbar-center">
						<!-- Center reserved for agent-specific -->
					</div>
					<div class="bottom-navbar-right">
						<!-- Right buttons are agent-specific, not global -->
					</div>
				</div>
			</div>
		</div>
	`

	// Add sidebar toggle handlers for maiadb agent
	setTimeout(() => {
		const agentContainer = document.querySelector('.agent-container')
		if (agentContainer?.shadowRoot) {
			const navAside = agentContainer.shadowRoot.querySelector('.nav-aside')
			const detailAside = agentContainer.shadowRoot.querySelector('.detail-aside')

			// Start collapsed by default, no transitions
			if (navAside) {
				navAside.classList.add('collapsed')
			}
			if (detailAside) {
				detailAside.classList.add('collapsed')
			}

			// Add toggle handlers
			const navToggle = agentContainer.shadowRoot.querySelector('.nav-toggle')
			const detailToggle = agentContainer.shadowRoot.querySelector('.detail-toggle')

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

	// Load agent asynchronously after DOM is updated
	requestAnimationFrame(async () => {
		try {
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Ensure only one agent container exists (cleanup any duplicates)
			const allContainers = document.querySelectorAll('.agent-container')
			if (allContainers.length > 1) {
				const targetContainer = document.getElementById(`agent-container-${currentAgent}`)
				for (const container of allContainers) {
					if (container !== targetContainer) {
						container.remove()
					}
				}
			}

			const container = document.getElementById(`agent-container-${currentAgent}`)
			if (!container) {
				return
			}
			if (!maia) {
				return
			}

			// Clear container before loading new agent (remove any existing content)
			container.innerHTML = ''

			// Load agent from spark context (registries.sparks[spark].agents)
			await maia.loadAgentFromAccount(currentAgent, container, currentSpark || '°Maia')

			// Add sidebar toggle handlers for maiadb agent (after agent loads)
			setTimeout(() => {
				const agentContainerEl = document.getElementById(`agent-container-${currentAgent}`)
				if (agentContainerEl) {
					const shadowRoot = agentContainerEl.shadowRoot || agentContainerEl
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
			window.currentAgentContainer = container
		} catch (error) {
			const container = document.getElementById(`agent-container-${currentAgent}`)
			if (container) {
				container.innerHTML = `<div class="empty-state p-8 text-center text-rose-500 font-medium bg-rose-50/50 rounded-2xl border border-rose-100">Error loading agent: ${error.message}</div>`
			}
		}
	})
}
