/**
 * Dashboard and Vibe Viewer Rendering
 * Handles dashboard screen and vibe viewer rendering
 */

import { truncate } from './utils.js';

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
 * Load vibes from account.vibes registry dynamically using read() API
 * The read() API handles reactivity internally - we just read the current data
 * @param {Object} maia - MaiaOS instance
 * @returns {Promise<Array>} Array of vibe objects with {key, label, coId}
 */
async function loadVibesFromAccount(maia) {
	const vibes = [];
	
	if (!maia) {
		return vibes;
	}
	
	try {
		const account = maia.id.maiaId;
		// Read account.vibes CoMap using read() API operations
		// The read() API handles reactivity internally - we just read the current value
		const accountStore = await maia.db({op: 'read', schema: '@account', key: account.id});
		const accountData = accountStore.value || accountStore;
		
		// Operations API returns flat objects: {id: '...', profile: '...', vibes: '...'}
		if (accountData && accountData.vibes && typeof accountData.vibes === 'string' && accountData.vibes.startsWith('co_')) {
			const vibesId = accountData.vibes;
			const vibesStore = await maia.db({op: 'read', schema: vibesId, key: vibesId});
			const vibesData = vibesStore.value || vibesStore;
			
			// Operations API returns flat objects: {id: '...', todos: 'co_...', ...}
			if (vibesData && typeof vibesData === 'object' && !Array.isArray(vibesData)) {
				console.log('[Dashboard] account.vibes data:', vibesData);
				// Extract vibe keys (exclude metadata keys)
				const vibeKeys = Object.keys(vibesData).filter(k => 
					k !== 'id' && 
					k !== 'loading' && 
					k !== 'error' && 
					k !== '$schema' && 
					k !== 'type'
				);
				console.log('[Dashboard] Found vibe keys:', vibeKeys);
				
				// Add each vibe from account.vibes
				for (const vibeKey of vibeKeys) {
					const vibeCoId = vibesData[vibeKey];
					if (typeof vibeCoId === 'string' && vibeCoId.startsWith('co_')) {
						// Map vibe keys to display names
						const vibeNameMap = {
							'my-data': 'MaiaDB',
							'todos': 'Todos'
						};
						const displayName = vibeNameMap[vibeKey] || `${vibeKey.charAt(0).toUpperCase() + vibeKey.slice(1)} Vibe`;
						vibes.push({
							key: vibeKey,
							label: displayName,
							coId: vibeCoId
						});
					}
				}
				console.log('[Dashboard] Loaded vibes:', vibes.map(v => v.key));
			}
		}
	} catch (error) {
		console.warn('[Dashboard] Failed to load vibes dynamically:', error);
	}
	
	return vibes;
}

/**
 * Render dashboard screen with grid layout
 * Uses clean read() API - no manual subscription handling needed
 */
export async function renderDashboard(maia, authState, syncState, navigateToScreen) {
	const accountId = maia?.id?.maiaId?.id || '';
	
	// Load vibes dynamically using clean read() API (handles reactivity internally)
	const vibes = await loadVibesFromAccount(maia);
	
	// Create DB Viewer card
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
	
	// Create vibe cards
	const vibeCards = vibes.map(vibe => `
		<div class="dashboard-card whitish-card" onclick="window.loadVibe('${escapeHtml(vibe.key)}')">
			<div class="dashboard-card-content">
				<div class="dashboard-card-icon">
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
					</svg>
				</div>
				<h3 class="dashboard-card-title">${escapeHtml(vibe.label)}</h3>
				<p class="dashboard-card-description">Open ${escapeHtml(vibe.label)}</p>
			</div>
		</div>
	`).join('');
	
	const cards = dbViewerCard + vibeCards;
	
	document.getElementById("app").innerHTML = `
		<div class="db-container">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>Me</h1>
					</div>
					<div class="header-center">
						<!-- Logo centered in navbar -->
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						${authState.signedIn ? `
							<code class="db-status">${truncate(accountId, 12)}</code>
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
						<!-- Sync Status Indicator -->
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}">
							<span class="sync-dot"></span>
							<span class="sync-text">
								${syncState.connected && syncState.syncing ? 'Syncing' : 
								  syncState.connected ? 'Connected' : 
								  syncState.error || 'Offline'}
							</span>
						</div>
						${authState.signedIn ? `
							<button class="sign-out-btn" onclick="window.handleSignOut()">
								Sign Out
							</button>
						` : ''}
					</div>
				</div>
				<!-- Mobile menu (collapsed by default) -->
				<div class="mobile-menu" id="mobile-menu">
					${authState.signedIn ? `
						<button class="mobile-menu-item seed-btn" onclick="window.handleSeed(); window.toggleMobileMenu();" title="Seed database">
							Seed
						</button>
					` : ''}
					<div class="mobile-menu-item sync-status ${syncState.connected ? 'connected' : 'disconnected'}">
						<span class="sync-dot"></span>
						<span class="sync-text">
							${syncState.connected && syncState.syncing ? 'Syncing' : 
							  syncState.connected ? 'Connected' : 
							  syncState.error || 'Offline'}
						</span>
					</div>
					${authState.signedIn ? `
						<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">
							Sign Out
						</button>
					` : ''}
				</div>
			</header>
			
			<div class="dashboard-main">
				<div class="dashboard-grid">
					${cards || '<div class="empty-state p-12 text-center text-slate-400 italic">No apps available</div>'}
				</div>
			</div>
		</div>
	`;
}

/**
 * Render vibe viewer screen (full-screen vibe display)
 */
export async function renderVibeViewer(maia, authState, syncState, currentVibe, navigateToScreen) {
	const accountId = maia?.id?.maiaId?.id || '';
	// Map vibe keys to display names
	const vibeNameMap = {
		'my-data': 'MaiaDB',
		'todos': 'Todos'
	};
	const vibeLabel = currentVibe ? (vibeNameMap[currentVibe] || `${currentVibe.charAt(0).toUpperCase() + currentVibe.slice(1)} Vibe`) : 'Vibe';
	
	// Clear any existing vibe containers before rendering new one
	// This ensures we don't have multiple vibe containers stacked
	const app = document.getElementById("app");
	if (app) {
		// Find and remove any existing vibe containers
		const existingContainers = app.querySelectorAll('.vibe-container');
		for (const container of existingContainers) {
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
						${authState.signedIn ? `
							<code class="db-status">${truncate(accountId, 12)}</code>
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
						<!-- Sync Status Indicator -->
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}">
							<span class="sync-dot"></span>
							<span class="sync-text">
								${syncState.connected && syncState.syncing ? 'Syncing' : 
								  syncState.connected ? 'Connected' : 
								  syncState.error || 'Offline'}
							</span>
						</div>
						${authState.signedIn ? `
							<button class="sign-out-btn" onclick="window.handleSignOut()">
								Sign Out
							</button>
						` : ''}
					</div>
				</div>
				<!-- Mobile menu (collapsed by default) -->
				<div class="mobile-menu" id="mobile-menu">
					${authState.signedIn ? `
						<button class="mobile-menu-item seed-btn" onclick="window.handleSeed(); window.toggleMobileMenu();" title="Seed database">
							Seed
						</button>
					` : ''}
					<div class="mobile-menu-item sync-status ${syncState.connected ? 'connected' : 'disconnected'}">
						<span class="sync-dot"></span>
						<span class="sync-text">
							${syncState.connected && syncState.syncing ? 'Syncing' : 
							  syncState.connected ? 'Connected' : 
							  syncState.error || 'Offline'}
						</span>
					</div>
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
				<!-- Bottom navbar area for mobile -->
				<div class="bottom-navbar">
					<div class="bottom-navbar-left">
						<button class="sidebar-toggle-btn sidebar-toggle-left" onclick="window.toggleLeftSidebar()" aria-label="Toggle navigation sidebar">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="3" y1="12" x2="21" y2="12"></line>
								<line x1="3" y1="6" x2="21" y2="6"></line>
								<line x1="3" y1="18" x2="21" y2="18"></line>
							</svg>
						</button>
					</div>
					<div class="bottom-navbar-center">
						<button class="home-btn bottom-home-btn" onclick="window.navigateToScreen('dashboard')" title="Home">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
								<polyline points="9 22 9 12 15 12 15 22"></polyline>
							</svg>
							<span class="home-label">Home</span>
						</button>
					</div>
					<div class="bottom-navbar-right">
						<button class="sidebar-toggle-btn sidebar-toggle-right" onclick="window.toggleRightSidebar()" aria-label="Toggle detail sidebar">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"></circle>
								<path d="M12 16v-4M12 8h.01"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
			
			<!-- Bottom navbar area for mobile -->
			<div class="bottom-navbar">
				<div class="bottom-navbar-left">
					<button class="sidebar-toggle-btn sidebar-toggle-left" onclick="window.toggleLeftSidebar()" aria-label="Toggle navigation sidebar">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="3" y1="12" x2="21" y2="12"></line>
							<line x1="3" y1="6" x2="21" y2="6"></line>
							<line x1="3" y1="18" x2="21" y2="18"></line>
						</svg>
					</button>
				</div>
				<div class="bottom-navbar-center">
					<button class="home-btn bottom-home-btn" onclick="window.navigateToScreen('dashboard')" title="Home">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
							<polyline points="9 22 9 12 15 12 15 22"></polyline>
						</svg>
						<span class="home-label">Home</span>
					</button>
				</div>
				<div class="bottom-navbar-right">
					<button class="sidebar-toggle-btn sidebar-toggle-right" onclick="window.toggleRightSidebar()" aria-label="Toggle detail sidebar">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"></circle>
							<path d="M12 16v-4M12 8h.01"/>
						</svg>
					</button>
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
						console.log(`[Vibe Viewer] Removing duplicate container: ${container.id}`);
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
			
			console.log(`[Vibe Viewer] Loading vibe: ${currentVibe} into container: vibe-container-${currentVibe}`);
			
			// Clear container before loading new vibe (remove any existing content)
			// The kernel will handle actor detachment and reuse logic
			container.innerHTML = '';
			
			// Load vibe from account
			await maia.loadVibeFromAccount(currentVibe, container);
			
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
