/**
 * Dashboard and Vibe Viewer Rendering
 * Handles dashboard screen and vibe viewer rendering
 */

import { truncate, getSyncStatusMessage } from './utils.js';
import { getAllVibeRegistries } from '@MaiaOS/vibes';
import { resolveAccountCoIdsToProfileNames } from '@MaiaOS/kernel';

// Helper function to escape HTML
function escapeHtml(text) {
	if (text === null || text === undefined) {
		return '';
	}
	const div = document.createElement('div');
	div.textContent = String(text);
	return div.innerHTML;
}

/**
 * Helper function to truncate description to max words
 */
function truncateDescription(text, maxWords = 10) {
	if (!text) return '';
	const words = text.trim().split(/\s+/);
	if (words.length <= maxWords) return text;
	return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Extract vibe key from vibe $id (e.g., "@maia/vibe/todos" -> "todos")
 */
function getVibeKeyFromId(vibeId) {
	if (!vibeId) return null;
	if (vibeId.startsWith('@maia/vibe/')) {
		return vibeId.replace('@maia/vibe/', '');
	}
	return null;
}

/**
 * Get spark display name from spark co-id (reads spark CoMap)
 */
async function getSparkDisplayName(maia, sparkCoId) {
	try {
		const sparkStore = await maia.db({ op: 'read', schema: null, key: sparkCoId });
		const sparkData = sparkStore?.value ?? sparkStore;
		const name = sparkData?.name;
		return name ? (name.startsWith('@') ? name : `@${name}`) : null;
	} catch {
		return null;
	}
}

/**
 * Load available sparks (context scopes) from account.sparks
 * @param {Object} maia - MaiaOS instance
 * @returns {Promise<Array>} Array of spark objects with {key, name, description}
 */
async function loadSparksFromAccount(maia) {
	const sparks = [];

	if (!maia) return sparks;

	try {
		const account = maia.id.maiaId;
		const accountStore = await maia.db({ op: 'read', schema: '@account', key: account.id });
		const accountData = accountStore.value || accountStore;

		const sparksId = accountData?.sparks;
		if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_')) {
			return sparks;
		}

		const sparksStore = await maia.db({ op: 'read', schema: sparksId, key: sparksId });
		const sparksData = sparksStore.value || sparksStore;

		if (!sparksData || typeof sparksData !== 'object' || Array.isArray(sparksData)) return sparks;

		const sparkKeys = Object.keys(sparksData).filter(k =>
			k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type' &&
			typeof sparksData[k] === 'string' && sparksData[k].startsWith('co_')
		);

		for (const key of sparkKeys) {
			// key is co-id (new) or name like "@maia" (system spark)
			const displayName = key.startsWith('co_')
				? (await getSparkDisplayName(maia, key)) || key
				: (key.startsWith('@') ? key : `@${key}`);
			sparks.push({
				key,
				name: displayName,
				description: `Context scope for ${displayName}`
			});
		}
	} catch (error) {
		console.warn('[Dashboard] Failed to load sparks:', error);
	}
	return sparks;
}

/**
 * Load vibes from account.sparks[spark].vibes registry
 * @param {Object} maia - MaiaOS instance
 * @param {string} spark - Spark name (e.g. '@maia')
 * @returns {Promise<Array>} Array of vibe objects with {key, name, description, coId}
 */
async function loadVibesFromSpark(maia, spark) {
	const vibes = [];

	if (!maia || !spark) return vibes;

	try {
		const vibeRegistries = await getAllVibeRegistries();
		const vibeManifestMap = new Map();
		for (const registry of vibeRegistries) {
			if (registry.vibe) {
				const vibeKey = getVibeKeyFromId(registry.vibe.$id);
				if (vibeKey) {
					vibeManifestMap.set(vibeKey, {
						name: registry.vibe.name || vibeKey,
						description: registry.vibe.description || ''
					});
				}
			}
		}

		const account = maia.id.maiaId;
		const accountStore = await maia.db({ op: 'read', schema: '@account', key: account.id });
		const accountData = accountStore.value || accountStore;

		const sparksId = accountData?.sparks;
		if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_')) return vibes;

		const sparksStore = await maia.db({ op: 'read', schema: sparksId, key: sparksId });
		const sparksData = sparksStore.value || sparksStore;
		const sparkCoId = sparksData?.[spark];
		if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_')) return vibes;

		const sparkStore = await maia.db({ op: 'read', schema: null, key: sparkCoId });
		const sparkData = sparkStore.value || sparkStore;
		const vibesId = sparkData?.vibes;
		if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_')) return vibes;

		const vibesStore = await maia.db({ op: 'read', schema: vibesId, key: vibesId });
		const vibesData = vibesStore.value || vibesStore;

		if (!vibesData || typeof vibesData !== 'object' || Array.isArray(vibesData)) return vibes;

		const vibeKeys = Object.keys(vibesData).filter(k =>
			k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type' &&
			typeof vibesData[k] === 'string' && vibesData[k].startsWith('co_')
		);

		for (const vibeKey of vibeKeys) {
			const manifest = vibeManifestMap.get(vibeKey);
			const name = manifest?.name || `${vibeKey.charAt(0).toUpperCase() + vibeKey.slice(1)}`;
			const description = manifest?.description ? truncateDescription(manifest.description, 10) : `Open ${name}`;
			vibes.push({
				key: vibeKey,
				name,
				description,
				coId: vibesData[vibeKey]
			});
		}
	} catch (error) {
		console.warn('[Dashboard] Failed to load vibes for spark:', error);
	}
	return vibes;
}

/**
 * Render dashboard screen with grid context hierarchy
 * Level 1: Sparks (context scopes) + DB Viewer
 * Level 2: Vibes for selected spark (when currentSpark is set)
 */
export async function renderDashboard(maia, authState, syncState, navigateToScreen, currentSpark, loadSpark, loadVibe) {
	const accountId = maia?.id?.maiaId?.id || '';
	let accountDisplayName = truncate(accountId, 12);
	if (accountId && accountId.startsWith('co_z') && maia?.db) {
		try {
			const profileNames = await resolveAccountCoIdsToProfileNames(maia, [accountId]);
			accountDisplayName = profileNames.get(accountId) ?? accountDisplayName;
		} catch (e) {
			console.warn('[Dashboard] Failed to resolve account profile name:', e);
		}
	}
	const accountIdShort = accountId ? accountId.slice(0, 8) : '';

	let cards = '';

	if (!currentSpark) {
		// Level 1: Show sparks (context scopes) + DB Viewer
		const sparks = await loadSparksFromAccount(maia);

		const dbViewerCard = `
			<div class="dashboard-card whitish-card" onclick="window.navigateToScreen('db-viewer')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M4 7h16M4 12h16M4 17h16"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">DB Viewer</h3>
					<p class="dashboard-card-description">Explore and inspect your CoValues</p>
				</div>
			</div>
		`;

		const sparkCards = sparks.map(spark => `
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
		`).join('');

		cards = dbViewerCard + sparkCards;
	} else {
		// Level 2: Show vibes for the selected spark (no back card - Switch Spark in bottom navbar)
		const vibes = await loadVibesFromSpark(maia, currentSpark);

		const vibeCards = vibes.map(vibe => `
			<div class="dashboard-card whitish-card" onclick="window.loadVibe('${escapeHtml(vibe.key)}')">
				<div class="dashboard-card-content">
					<div class="dashboard-card-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
						</svg>
					</div>
					<h3 class="dashboard-card-title">${escapeHtml(vibe.name)}</h3>
					<p class="dashboard-card-description">${escapeHtml(vibe.description)}</p>
				</div>
			</div>
		`).join('');

		cards = vibeCards;
	}
	
	const headerTitle = currentSpark ? `${currentSpark} Vibes` : 'Me';

	document.getElementById("app").innerHTML = `
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
						<!-- Sync Status Indicator - moved to header, left of account ID -->
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}">
							<span class="sync-dot"></span>
							<span class="sync-text">
								${getSyncStatusMessage(syncState)}
							</span>
						</div>
						${authState.signedIn ? `
							<span class="db-status db-status-name" title="Account: ${accountId}">${escapeHtml(accountDisplayName)}</span>
						` : ''}
						<!-- Hamburger menu button (mobile only) -->
						<button class="hamburger-btn" onclick="window.toggleMobileMenu()" aria-label="Toggle menu">
							<span></span>
							<span></span>
							<span></span>
						</button>
						${authState.signedIn ? `
							<button class="seed-btn" onclick="window.handleSeed()" title="Seed database (idempotent - preserves schemata, recreates configs/data)">
								Seed
							</button>
						` : ''}
						${authState.signedIn ? `
							<button class="sign-out-btn" onclick="window.handleSignOut()">
								Sign Out
							</button>
						` : ''}
					</div>
				</div>
				<!-- Mobile menu (collapsed by default) - account ID shown inside -->
				<div class="mobile-menu" id="mobile-menu">
					${authState.signedIn && accountIdShort ? `
						<div class="mobile-menu-account-id" title="${accountId}">
							<code class="db-status">${accountIdShort}</code>
						</div>
					` : ''}
					${authState.signedIn ? `
						<button class="mobile-menu-item seed-btn" onclick="window.handleSeed(); window.toggleMobileMenu();" title="Seed database">
							Seed
						</button>
					` : ''}
					${authState.signedIn ? `
						<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">
							Sign Out
						</button>
					` : ''}
				</div>
			</header>

			<div class="dashboard-main ${currentSpark ? 'has-bottom-navbar' : ''}">
				<div class="dashboard-grid">
					${cards || `<div class="empty-state p-12 text-center text-slate-400 italic">${currentSpark ? 'No vibes in this context' : 'No context scopes available'}</div>`}
				</div>
			</div>
			${currentSpark ? `
			<!-- Bottom navbar - Switch Spark (same position as Home in vibe viewer) -->
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
			` : ''}
		</div>
	`;
}

/**
 * Render vibe viewer screen (full-screen vibe display)
 * @param {string} [currentSpark='@maia'] - Spark context scope for vibes
 */
export async function renderVibeViewer(maia, authState, syncState, currentVibe, navigateToScreen, currentSpark = '@maia') {
	const accountId = maia?.id?.maiaId?.id || '';
	let accountDisplayName = truncate(accountId, 12);
	if (accountId && accountId.startsWith('co_z') && maia?.db) {
		try {
			const profileNames = await resolveAccountCoIdsToProfileNames(maia, [accountId]);
			accountDisplayName = profileNames.get(accountId) ?? accountDisplayName;
		} catch (e) {
			console.warn('[VibeViewer] Failed to resolve account profile name:', e);
		}
	}
	const accountIdShort = accountId ? accountId.slice(0, 8) : '';
	// Map vibe keys to display names
	const vibeNameMap = {
		'db': 'MaiaDB',
		'todos': 'Todos'
	};
	const vibeLabel = currentVibe ? (vibeNameMap[currentVibe] || `${currentVibe.charAt(0).toUpperCase() + currentVibe.slice(1)} Vibe`) : 'Vibe';
	
	// Clear any existing vibe containers before rendering new one
	// This ensures we don't have multiple vibe containers stacked
	const app = document.getElementById("app");
	if (app) {
		const existingContainers = app.querySelectorAll('.vibe-container');
		for (const container of existingContainers) {
			if (maia?.actorEngine) maia.actorEngine.destroyActorsForContainer(container);
			container.remove();
		}
	}
	
	app.innerHTML = `
		<div class="db-container">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>${escapeHtml(vibeLabel)}</h1>
					</div>
					<div class="header-center">
						<!-- Logo centered in navbar -->
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						<!-- Sync Status Indicator - moved to header, left of account ID -->
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}">
							<span class="sync-dot"></span>
							<span class="sync-text">
								${getSyncStatusMessage(syncState)}
							</span>
						</div>
						${authState.signedIn ? `
							<span class="db-status db-status-name" title="Account: ${accountId}">${escapeHtml(accountDisplayName)}</span>
						` : ''}
						<!-- Hamburger menu button (mobile only) -->
						<button class="hamburger-btn" onclick="window.toggleMobileMenu()" aria-label="Toggle menu">
							<span></span>
							<span></span>
							<span></span>
						</button>
						${authState.signedIn ? `
							<button class="seed-btn" onclick="window.handleSeed()" title="Seed database (idempotent - preserves schemata, recreates configs/data)">
								Seed
							</button>
						` : ''}
						${authState.signedIn ? `
							<button class="sign-out-btn" onclick="window.handleSignOut()">
								Sign Out
							</button>
						` : ''}
					</div>
				</div>
				<!-- Mobile menu (collapsed by default) - account ID shown inside -->
				<div class="mobile-menu" id="mobile-menu">
					${authState.signedIn && accountIdShort ? `
						<div class="mobile-menu-account-id" title="${accountId}">
							<code class="db-status">${accountIdShort}</code>
						</div>
					` : ''}
					${authState.signedIn ? `
						<button class="mobile-menu-item seed-btn" onclick="window.handleSeed(); window.toggleMobileMenu();" title="Seed database">
							Seed
						</button>
					` : ''}
					${authState.signedIn ? `
						<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">
							Sign Out
						</button>
					` : ''}
				</div>
			</header>

			<div class="vibe-viewer-main">
				<div class="vibe-card">
					<div id="vibe-container-${escapeHtml(currentVibe)}" class="vibe-container"></div>
				</div>
				<!-- Bottom navbar area for mobile - only home button (vibe-specific buttons handled by vibes) -->
				<div class="bottom-navbar">
					<div class="bottom-navbar-left">
						<!-- Left buttons are vibe-specific, not global -->
					</div>
					<div class="bottom-navbar-center">
						<button class="home-btn bottom-home-btn" onclick="window.loadVibe(null)" title="Home">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
								<polyline points="9 22 9 12 15 12 15 22"></polyline>
							</svg>
							<span class="home-label">Home</span>
						</button>
					</div>
					<div class="bottom-navbar-right">
						<!-- Right buttons are vibe-specific, not global -->
					</div>
				</div>
			</div>
		</div>
	`;
	
	// Add sidebar toggle handlers for maiadb vibe
	setTimeout(() => {
		const vibeContainer = document.querySelector('.vibe-container');
		if (vibeContainer && vibeContainer.shadowRoot) {
			const navAside = vibeContainer.shadowRoot.querySelector('.nav-aside');
			const detailAside = vibeContainer.shadowRoot.querySelector('.detail-aside');
			
			// Start collapsed by default, no transitions
			if (navAside) {
				navAside.classList.add('collapsed');
			}
			if (detailAside) {
				detailAside.classList.add('collapsed');
			}
			
			// Add toggle handlers
			const navToggle = vibeContainer.shadowRoot.querySelector('.nav-toggle');
			const detailToggle = vibeContainer.shadowRoot.querySelector('.detail-toggle');
			
			if (navToggle) {
				navToggle.addEventListener('click', () => {
					if (navAside) {
						// Enable transitions when user explicitly toggles
						navAside.classList.add('sidebar-ready');
						navAside.classList.toggle('collapsed');
					}
				});
			}
			
			if (detailToggle) {
				detailToggle.addEventListener('click', () => {
					if (detailAside) {
						// Enable transitions when user explicitly toggles
						detailAside.classList.add('sidebar-ready');
						detailAside.classList.toggle('collapsed');
					}
				});
			}
		}
	}, 100);
	
	// Load vibe asynchronously after DOM is updated
	requestAnimationFrame(async () => {
		try {
			await new Promise(resolve => setTimeout(resolve, 10));
			
			// Ensure only one vibe container exists (cleanup any duplicates)
			const allContainers = document.querySelectorAll('.vibe-container');
			if (allContainers.length > 1) {
				console.warn(`[Vibe Viewer] Found ${allContainers.length} vibe containers, removing duplicates`);
				const targetContainer = document.getElementById(`vibe-container-${currentVibe}`);
				for (const container of allContainers) {
					if (container !== targetContainer) {
						container.remove();
					}
				}
			}
			
			const container = document.getElementById(`vibe-container-${currentVibe}`);
			if (!container) {
				console.error(`[Vibe Viewer] Container not found: vibe-container-${currentVibe}`);
				return;
			}
			if (!maia) {
				console.error(`[Vibe Viewer] MaiaOS instance not available`);
				return;
			}
			
			// Clear container before loading new vibe (remove any existing content)
			// The kernel will handle actor detachment and reuse logic
			container.innerHTML = '';
			
			// Load vibe from spark context (account.sparks[spark].vibes)
			await maia.loadVibeFromAccount(currentVibe, container, currentSpark || '@maia');
			
			// Add sidebar toggle handlers for maiadb vibe (after vibe loads)
			setTimeout(() => {
				// Use shadow root if vibe is in shadow DOM
				const vibeContainer = document.getElementById(`vibe-container-${currentVibe}`);
				if (vibeContainer) {
					const shadowRoot = vibeContainer.shadowRoot || vibeContainer;
					const navToggle = shadowRoot.querySelector('.nav-toggle');
					const detailToggle = shadowRoot.querySelector('.detail-toggle');
					
					if (navToggle) {
						navToggle.addEventListener('click', () => {
							const navAside = navToggle.closest('.nav-aside');
							if (navAside) {
								navAside.classList.toggle('collapsed');
							}
						});
					}
					
					if (detailToggle) {
						detailToggle.addEventListener('click', () => {
							const detailAside = detailToggle.closest('.detail-aside');
							if (detailAside) {
								detailAside.classList.toggle('collapsed');
							}
						});
					}
				}
			}, 500);
			
			// Store container reference for cleanup on unload
			window.currentVibeContainer = container;
		} catch (error) {
			console.error(`❌ Failed to load vibe ${currentVibe}:`, error);
			const container = document.getElementById(`vibe-container-${currentVibe}`);
			if (container) {
				container.innerHTML = `<div class="empty-state p-8 text-center text-rose-500 font-medium bg-rose-50/50 rounded-2xl border border-rose-100">Error loading vibe: ${error.message}</div>`;
			}
		}
	});
}
