/**
 * Maia DB View - Logged-in interface
 * Liquid glass design with widget-based layout
 */

import { truncate } from './utils.js'
// Import getSchema and getAllSchemas from schemas registry (hardcoded schemas)
import { getSchema, getAllSchemas } from '../../libs/maia-db/src/schemas/registry.js'

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
 * Toggle sidebar in Shadow DOM
 * Finds the sidebar element within any Shadow DOM in the vibe container
 */
function toggleSidebarInShadowDOM(selector) {
	const vibeContainer = document.querySelector('.vibe-container');
	if (!vibeContainer) return;
	
	// Try to find sidebar in Shadow DOM
	const shadowRoot = vibeContainer.shadowRoot;
	if (shadowRoot) {
		const sidebar = shadowRoot.querySelector(selector);
		if (sidebar) {
			sidebar.classList.toggle('collapsed');
			return;
		}
	}
	
	// Fallback: try to find in regular DOM (for non-Shadow DOM vibes)
	const sidebar = document.querySelector(selector);
	if (sidebar) {
		sidebar.classList.toggle('collapsed');
	}
}

/**
 * Load vibes from account.vibes registry dynamically using read() API
 * The read() API handles reactivity internally - we just read the current data
 * @param {Object} maia - MaiaOS instance
 * @param {Object} cojsonAPI - CoJSON API instance
 * @returns {Promise<Array>} Array of vibe objects with {key, label, coId}
 */
async function loadVibesFromAccount(maia, cojsonAPI) {
	const vibes = [];
	
	if (!maia || !cojsonAPI) {
		return vibes;
	}
	
	try {
		const account = maia.id.maiaId;
		// Read account.vibes CoMap using read() API operations
		// The read() API handles reactivity internally - we just read the current value
		const accountStore = await cojsonAPI.cojson({op: 'read', schema: '@account', key: account.id});
		const accountData = accountStore.value || accountStore;
		
		// Operations API returns flat objects: {id: '...', profile: '...', vibes: '...'}
		if (accountData && accountData.vibes && typeof accountData.vibes === 'string' && accountData.vibes.startsWith('co_')) {
			const vibesId = accountData.vibes;
			const vibesStore = await cojsonAPI.cojson({op: 'read', schema: vibesId, key: vibesId});
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
async function renderDashboard(maia, cojsonAPI, authState, syncState, navigateToScreen) {
	const accountId = maia?.id?.maiaId?.id || '';
	
	// Load vibes dynamically using clean read() API (handles reactivity internally)
	const vibes = await loadVibesFromAccount(maia, cojsonAPI);
	
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
async function renderVibeViewer(maia, cojsonAPI, authState, syncState, currentVibe, navigateToScreen) {
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

export async function renderApp(maia, cojsonAPI, authState, syncState, currentScreen, currentView, currentContextCoValueId, currentVibe, switchView, selectCoValue, loadVibe, navigateToScreen) {
	// Route to appropriate screen based on currentScreen
	if (currentScreen === 'dashboard') {
		// Dashboard uses clean read() API - no subscription handling needed
		await renderDashboard(maia, cojsonAPI, authState, syncState, navigateToScreen);
		return;
	}
	
	if (currentScreen === 'vibe-viewer' && currentVibe) {
		await renderVibeViewer(maia, cojsonAPI, authState, syncState, currentVibe, navigateToScreen);
		return;
	}
	
	// Default: render DB viewer (currentScreen === 'db-viewer')
	// Helper to render any value consistently
	const renderValue = (value, depth = 0) => {
		if (depth > 2) return '<span class="nested-depth">...</span>';
		if (value === null) return '<span class="null-value text-xs text-slate-400 italic">null</span>';
		if (value === undefined) return '<span class="undefined-value text-xs text-slate-400 italic">undefined</span>';
		
		if (typeof value === 'string') {
			if (value.startsWith('co_')) {
				return `<code class="co-id text-xs text-marine-blue-muted hover:underline clickable" onclick="selectCoValue('${value}')" title="${value}">${truncate(value, 12)}</code>`;
			}
			if (value.startsWith('key_')) {
				return `<code class="key-value text-xs text-marine-blue-muted" title="${value}">${truncate(value, 30)}</code>`;
			}
			if (value.startsWith('sealed_')) {
				return '<code class="sealed-value text-xs text-marine-blue-muted italic">sealed_***</code>';
			}
			
			const maxLength = 100;
			const truncated = value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
			return `<span class="string-value text-xs text-marine-blue-muted break-all min-w-0 text-right" title="${value}">"${escapeHtml(truncated)}"</span>`;
		}
		
		if (typeof value === 'boolean') {
			return `<span class="boolean-value ${value ? 'true' : 'false'} text-xs font-semibold ${value ? 'text-lush-green bg-lush-green/10' : 'text-marine-blue-muted bg-white/10'} px-1.5 py-0.5 rounded">${value}</span>`;
		}
		
		if (typeof value === 'number') {
			return `<span class="number-value text-xs text-marine-blue-muted font-medium">${value}</span>`;
		}
		
		if (Array.isArray(value)) {
			// Truncate array preview to max 24 characters
			const preview = `[${value.length} ${value.length === 1 ? 'item' : 'items'}]`;
			const truncated = preview.length > 24 ? preview.substring(0, 21) + '...' : preview;
			return `<span class="array-value text-xs text-marine-blue-light italic" title="${escapeHtml(JSON.stringify(value))}">${escapeHtml(truncated)}</span>`;
		}
		
		if (typeof value === 'object' && value !== null) {
			// Create a compact JSON preview string, truncated to max 24 characters total (including "OBJECT >")
			const objectIndicator = ' OBJECT >';
			const maxJsonLength = 24 - objectIndicator.length; // Reserve space for " OBJECT >"
			
			try {
				const jsonString = JSON.stringify(value);
				let truncated = jsonString;
				if (jsonString.length > maxJsonLength) {
					truncated = jsonString.substring(0, maxJsonLength - 3) + '...';
				}
				return `<span class="object-value text-xs text-marine-blue-light italic" title="${escapeHtml(jsonString)}">${escapeHtml(truncated)}<span class="text-marine-blue-light/50">${objectIndicator}</span></span>`;
			} catch (e) {
				// Fallback if JSON.stringify fails
				const keys = Object.keys(value);
				const preview = `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`;
				let truncated = preview;
				if (preview.length > maxJsonLength) {
					truncated = preview.substring(0, maxJsonLength - 3) + '...';
				}
				return `<span class="object-value text-xs text-marine-blue-light italic">${escapeHtml(truncated)}<span class="text-marine-blue-light/50">${objectIndicator}</span></span>`;
			}
		}
		
		return `<span class="text-xs text-marine-blue-muted">${escapeHtml(String(value))}</span>`;
	};

	// Helper to format JSON properly (parse if string, then stringify with indentation)
	const formatJSON = (value) => {
		if (typeof value === 'string') {
			// Try to parse as JSON first
			try {
				const parsed = JSON.parse(value);
				return JSON.stringify(parsed, null, 2);
			} catch (e) {
				// Not valid JSON, return as-is
				return value;
			}
		} else if (Array.isArray(value)) {
			// Explicitly handle arrays
			return JSON.stringify(value, null, 2);
		} else if (typeof value === 'object' && value !== null) {
			// Handle objects
			return JSON.stringify(value, null, 2);
		} else {
			return String(value);
		}
	};

	// Helper to render a property row consistently
	const renderPropertyRow = (label, value, type, key, isExpandable = false, expandId = '', schemaTitle = '') => {
		const typeClass = type ? type.replace(/-/g, '') : 'unknown';
		const isCoIdClickable = type === 'co-id';
		const isClickable = isCoIdClickable || isExpandable;
		
		let onclickHandler = '';
		if (isCoIdClickable) {
			onclickHandler = `onclick="selectCoValue('${value}')"`;
		} else if (isExpandable) {
			onclickHandler = `onclick="event.stopPropagation(); toggleExpand('${expandId}')"`;
		}

		return `
			<div class="property-item-wrapper w-full">
				<button 
					type="button"
					class="list-item-card property-item-button w-full ${isClickable ? 'hoverable' : ''} group"
					${onclickHandler}
				>
					<div class="flex justify-between items-center gap-3">
						<!-- Left side: Property Key -->
						<div class="flex items-center gap-2 flex-shrink-0 min-w-0">
							<span class="text-[10px] font-bold text-marine-blue-light uppercase tracking-widest truncate group-hover:text-marine-blue transition-colors" title="${key}">
								${label}
							</span>
							${isExpandable ? `<svg class="w-3 h-3 text-marine-blue-light/50 group-hover:text-marine-blue transition-colors expand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>` : ''}
						</div>
						
						<!-- Right side: Value and Badge -->
						<div class="flex items-center gap-2.5 flex-1 justify-end min-w-0">
							<div class="value-container flex-1 flex justify-end truncate">
								${renderValue(value)}
							</div>
							<span class="badge badge-type badge-${typeClass} text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-tighter rounded-md border border-white/50 shadow-sm">${type.toUpperCase()}</span>
							${isClickable ? `
								<svg class="w-3 h-3 text-marine-blue-light/50 group-hover:text-marine-blue transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
							` : ''}
						</div>
					</div>
				</button>
				${isExpandable ? `
					<div id="${expandId}" class="expanded-content bg-white/20 backdrop-blur-md border-t border-white/10 p-3 mt-1 rounded-b-xl" style="display: none;">
						<pre class="json-display text-[11px] font-mono text-marine-blue-muted leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(formatJSON(value))}</pre>
					</div>
				` : ''}
			</div>
		`;
	};

	// Get data based on current view
	let data, viewTitle, viewSubtitle;
	
	// Load schemas from hardcoded registry (no dynamic loading)
	const allSchemas = getAllSchemas();
	
	// Get account and node for navigation
	const account = maia.id.maiaId;
	const node = maia.id.node;

	// Default to showing account if no context is set
	if (!currentContextCoValueId && account?.id) {
		currentContextCoValueId = account.id;
	}

	// Explorer-style navigation: if a CoValue is loaded into context, show it in main container
	if (currentContextCoValueId && cojsonAPI) {
		try {
			// Use unified read API - query by ID (key parameter)
			// Note: schema is required by ReadOperation, but backend handles key-only reads
			// Using the coId as schema is a workaround - backend will use key parameter
			const store = await cojsonAPI.cojson({op: 'read', schema: currentContextCoValueId, key: currentContextCoValueId});
			// ReadOperation returns a ReactiveStore - get current value
			let contextData = store.value || store;
			// Operations API returns flat objects: {id: '...', profile: '...', vibes: '...'}
			// Convert to normalized format for DB Viewer display
			const hasProperties = contextData && typeof contextData === 'object' && !Array.isArray(contextData) && Object.keys(contextData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length > 0;
			const propertiesCount = hasProperties ? Object.keys(contextData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length : 0;
			
			data = contextData;
			
			// Subscribe to ReactiveStore updates for reactivity
			if (typeof store.subscribe === 'function') {
				// Count properties from flat object (exclude metadata keys)
				const flatPropertyCount = contextData && typeof contextData === 'object' && !Array.isArray(contextData) 
					? Object.keys(contextData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length 
					: 0;
				let lastPropertiesCount = contextData?.loading ? -1 : flatPropertyCount;
				let lastLoadingState = contextData?.loading || false;
				let lastDataHash = JSON.stringify({ 
					propsCount: lastPropertiesCount, 
					loading: lastLoadingState, 
					hasError: !!contextData?.error
				});
				
				store.subscribe((updatedData) => {
					// Check if data actually changed (properties appeared, loading state changed, etc.)
					// Count properties from flat object (exclude metadata keys)
					const currentFlatPropertyCount = updatedData && typeof updatedData === 'object' && !Array.isArray(updatedData)
						? Object.keys(updatedData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length
						: 0;
					const currentPropertiesCount = updatedData?.loading ? -1 : currentFlatPropertyCount;
					const currentLoadingState = updatedData?.loading || false;
					const currentDataHash = JSON.stringify({ 
						propsCount: currentPropertiesCount, 
						loading: currentLoadingState,
						hasError: !!updatedData?.error
					});
					
					const dataChanged = currentDataHash !== lastDataHash;
					
					if (updatedData && dataChanged) {
						lastPropertiesCount = currentPropertiesCount;
						lastLoadingState = currentLoadingState;
						lastDataHash = currentDataHash;
						// Use setTimeout to prevent infinite loops and batch updates
						setTimeout(() => {
							renderApp(maia, cojsonAPI, authState, syncState, currentScreen, currentView, currentContextCoValueId, currentVibe, switchView, selectCoValue, loadVibe, navigateToScreen);
						}, 0);
					}
				});
				// ReactiveStore handles cleanup automatically
			}
			// Use ID as title (no displayName logic)
			viewTitle = contextData.id ? truncate(contextData.id, 24) : 'CoValue';
			viewSubtitle = '';
		} catch (err) {
			console.error('Error querying context CoValue:', err);
			data = { error: err.message, id: currentContextCoValueId, loading: false };
			viewTitle = 'Error';
			viewSubtitle = '';
		}
	} else if (currentView && cojsonAPI) {
		// Filter by schema
		// ReadOperation requires schema to be a co-id (co_z...)
		// If currentView is not a co-id, get all CoValues and filter manually
		try {
			if (currentView.startsWith('co_z')) {
				// Schema is already a co-id - use unified read API
				const store = await cojsonAPI.cojson({op: 'read', schema: currentView});
				// ReadOperation returns a ReactiveStore - get current value
				let result = store.value || store;
				data = Array.isArray(result) ? result : [];
				
				// Subscribe to ReactiveStore updates for reactivity
				if (typeof store.subscribe === 'function') {
					let lastLength = result.length;
					store.subscribe((updatedResult) => {
						// Re-render when store updates (check if data actually changed)
						if (updatedResult && Array.isArray(updatedResult) && updatedResult.length !== lastLength) {
							console.log(`🔄 [DB Viewer] Store updated for schema ${currentView.substring(0, 12)}..., re-rendering...`);
							lastLength = updatedResult.length;
							// Use setTimeout to prevent infinite loops and batch updates
							setTimeout(() => {
								renderApp(maia, cojsonAPI, authState, syncState, currentScreen, currentView, currentContextCoValueId, currentVibe, switchView, selectCoValue, loadVibe, navigateToScreen);
							}, 0);
						}
					});
					// ReactiveStore handles cleanup automatically
				}
			} else {
				// Human-readable schema name - get all CoValues and filter by schema
				const allCoValues = maia.getAllCoValues();
				data = allCoValues
					.filter(cv => {
						// Match schema name (can be in various formats)
						const schema = cv.$schema || cv.schema; // Prefer $schema, fallback to schema
						return schema === currentView || 
							   schema === `@schema/${currentView}` ||
							   (cv.headerMeta?.$schema === currentView);
					})
					.map(cv => ({
						displayName: cv.$schema || cv.schema || cv.id, // Prefer $schema
						...cv
					}));
			}
		} catch (err) {
			console.error('Error querying by schema:', err);
			data = [];
		}
		const schema = getSchema(currentView) || allSchemas[currentView];
		viewTitle = schema?.title || currentView;
		viewSubtitle = `${Array.isArray(data) ? data.length : 0} CoValue(s)`;
	} else {
		// Default: show account ID if available
		viewTitle = account?.id ? truncate(account.id, 24) : 'CoValue';
		viewSubtitle = '';
	}
	
	// Build account structure navigation (Account only - vibes removed from sidebar)
	const navigationItems = [];
	
	// Entry 1: Account itself
	navigationItems.push({
		id: account.id,
		label: 'Account',
		type: 'account'
	});

	// Build table content based on view
	let tableContent = '';
	let headerInfo = null; // Store header info for colist/costream to display in inspector-header
	
	// DB Viewer only shows DB content (no vibe rendering here)
	if (currentContextCoValueId && data) {
		// Explorer-style: if context CoValue is loaded, show its properties in main container
		// Show CoValue properties in main container (reuse property rendering from detail view)
		if (data.error && !data.loading) {
			tableContent = `<div class="empty-state p-8 text-center text-rose-500 font-medium bg-rose-50/50 rounded-2xl border border-rose-100">Error: ${data.error}</div>`;
		} else if (data.loading) {
			tableContent = `
				<div class="empty-state p-12 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100">
					<div class="loading-spinner w-8 h-8 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
					<p class="mt-4 text-slate-500 font-medium">Loading CoValue... (waiting for verified state)</p>
				</div>
			`;
		} else if (data.type === 'colist' || data.type === 'costream') {
			// CoList/CoStream: Display items directly (they ARE the list/stream, no properties)
			const items = data.items || [];
			const isStream = data.type === 'costream';
			const typeLabel = isStream ? 'CoStream' : 'CoList';
			
			// Store header info for display in inspector-header
			headerInfo = {
				type: data.type,
				typeLabel: typeLabel,
				itemCount: items.length,
				description: isStream ? 'Append-only stream' : 'Ordered list'
			};
			
			const itemRows = items.map((item, index) => {
				const label = `#${index + 1}`;
				let type = typeof item;
				if (typeof item === 'string' && item.startsWith('co_')) {
					type = 'co-id';
				} else if (Array.isArray(item)) {
					type = 'array';
				} else if (typeof item === 'object' && item !== null) {
					type = 'object';
				}
				
				// Make objects and arrays expandable
				const isExpandable = (typeof item === 'object' && item !== null) || Array.isArray(item);
				const expandId = isExpandable ? `expand-item-${index}-${Math.random().toString(36).substr(2, 9)}` : '';
				
				return renderPropertyRow(label, item, type, label, isExpandable, expandId);
			}).join('');

			tableContent = `
				<div class="list-stream-container space-y-4">
					<div class="list-view-container space-y-1">
						${items.length > 0 ? itemRows : `<div class="p-8 text-center text-slate-400 italic bg-slate-50/30 rounded-xl border border-dashed border-slate-200">No items in this ${typeLabel.toLowerCase()}</div>`}
					</div>
				</div>
			`;
		} else if (data && typeof data === 'object' && !Array.isArray(data) && !data.error && !data.loading) {
			// CoMap: Display properties from flat object format (operations API)
			// Convert flat object to normalized format for display
			const schemaCoId = data.$schema || data.schema; // Prefer $schema, fallback to schema
			const schemaDef = schemaCoId ? getSchema(schemaCoId) : null;
			
			// Extract properties from flat object (exclude metadata keys)
			const propertyKeys = Object.keys(data).filter(k => 
				k !== 'id' && 
				k !== 'loading' && 
				k !== 'error' && 
				k !== '$schema' && 
				k !== 'schema' && 
				k !== 'type' &&
				k !== 'displayName' &&
				k !== 'headerMeta'
			);
			
			if (propertyKeys.length === 0) {
				// No properties - show empty state
				tableContent = '<div class="empty-state p-12 text-center text-slate-400 italic bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">No properties available</div>';
			} else {
				const propertyItems = propertyKeys.map(key => {
					const value = data[key];
					let propType = typeof value;
				
					// Detect co-id references
					if (typeof value === 'string' && value.startsWith('co_')) {
						propType = 'co-id';
					} else if (typeof value === 'string' && value.startsWith('key_')) {
						propType = 'key';
					} else if (typeof value === 'string' && value.startsWith('sealed_')) {
						propType = 'sealed';
					} else if (Array.isArray(value)) {
						propType = 'array';
					} else if (typeof value === 'object' && value !== null) {
						propType = 'object';
					}
					
					const propSchema = schemaDef?.properties?.[key];
					const propLabel = propSchema?.title || key;
					
					// Make objects and arrays expandable
					const isExpandable = propType === 'object' || propType === 'array' || 
						(typeof value === 'object' && value !== null && !Array.isArray(value)) ||
						Array.isArray(value);
					const expandId = isExpandable ? `expand-${key}-${Math.random().toString(36).substr(2, 9)}` : '';
					
					return renderPropertyRow(propLabel, value, propType, key, isExpandable, expandId);
				}).join('');
			
				tableContent = `
					<div class="list-view-container space-y-1">
						${propertyItems}
					</div>
				`;
			}
		} else {
			// Fallback: empty or no properties
			tableContent = '<div class="empty-state p-12 text-center text-slate-400 italic bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">No properties available</div>';
		}
	} else {
		// Default view - show list of CoValues or error
		tableContent = '<div class="empty-state p-12 text-center text-slate-400 italic bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">Select a CoValue to explore its content</div>';
	}

	// Get account ID for header status
	const accountId = maia?.id?.maiaId?.id || '';
	
	// Metadata sidebar (explorer-style navigation)
	let metadataSidebar = '';
	if (currentContextCoValueId && data && !data.error && !data.loading) {
		const groupInfo = data.groupInfo || null;
		const hasMembers = groupInfo && (groupInfo.accountMembers?.length > 0 || groupInfo.groupMembers?.length > 0);

		// Sort account members: "everyone" first
		const sortedAccountMembers = groupInfo?.accountMembers ? [...groupInfo.accountMembers].sort((a, b) => {
			if (a.id === 'everyone') return -1;
			if (b.id === 'everyone') return 1;
			return 0;
		}) : [];

		// Fetch schema title if schema is a co-id using the abstracted read operation API
		let schemaTitle = null;
		const schemaCoId = data.$schema || data.schema; // Prefer $schema, fallback to schema
		if (schemaCoId && schemaCoId.startsWith('co_z') && cojsonAPI) {
			try {
				// Use unified read API - same pattern as loading main context data
				const schemaStore = await cojsonAPI.cojson({op: 'read', schema: schemaCoId, key: schemaCoId});
				const schemaData = schemaStore.value || schemaStore;
				
				if (schemaData && !schemaData.error && !schemaData.loading) {
					// Operations API returns flat objects: {id: '...', title: '...', definition: {...}, ...}
					if (schemaData && typeof schemaData === 'object' && !Array.isArray(schemaData)) {
						// Check title directly
						if (schemaData.title && typeof schemaData.title === 'string') {
							schemaTitle = schemaData.title;
						}
						// Also check definition.title for schema definitions
						if (!schemaTitle && schemaData.definition && typeof schemaData.definition === 'object') {
							schemaTitle = schemaData.definition.title || null;
						}
					}
				}
			} catch (e) {
				console.warn('[DB Viewer] Failed to fetch schema title:', e);
			}
		}
		
		metadataSidebar = `
			<aside class="db-metadata">
				<div class="metadata-content">
					<!-- Consolidated Metadata View (no tabs) -->
					<div class="metadata-info-list">
						<!-- ID first (item's own ID) -->
						<div class="metadata-info-item">
							<span class="metadata-info-key">ID</span>
							<code class="metadata-info-value" title="${data.id}">${truncate(data.id, 24)}</code>
						</div>
						${schemaCoId ? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">@SCHEMA</span>
								${schemaCoId.startsWith('co_') ? `
									${schemaTitle ? `
										<code class="metadata-info-value co-id" onclick="selectCoValue('${schemaCoId}')" title="${schemaCoId}" style="cursor: pointer; text-decoration: underline;">
											${escapeHtml(schemaTitle)}
										</code>
										<div class="metadata-info-schema-id" title="${schemaCoId}">${truncate(schemaCoId, 24)}</div>
									` : `
										<code class="metadata-info-value co-id" onclick="selectCoValue('${schemaCoId}')" title="${schemaCoId}" style="cursor: pointer; text-decoration: underline;">
											${truncate(schemaCoId, 24)}
										</code>
									`}
								` : `
									<code class="metadata-info-value" title="${schemaCoId}">
										${schemaCoId}
									</code>
								`}
							</div>
						` : ''}
						<div class="metadata-info-item">
							<span class="metadata-info-key">CONTENT TYPE</span>
							<span class="badge badge-type badge-${String(data.type || 'unknown').replace(/-/g, '')}">
								${data.type === 'colist' ? 'COLIST' : data.type === 'costream' ? 'COSTREAM' : String(data.type || 'unknown').toUpperCase()}
							</span>
						</div>
						${groupInfo?.groupId ? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">GROUP</span>
								<code class="metadata-info-value co-id" onclick="selectCoValue('${groupInfo.groupId}')" title="${groupInfo.groupId}">${truncate(groupInfo.groupId, 24)}</code>
							</div>
						` : ''}
					</div>
					
					<!-- Members Section (if group info available) -->
					${groupInfo ? (
						hasMembers ? `
							<div class="metadata-members">
								${sortedAccountMembers.length > 0 ? `
									<div class="metadata-section">
										<h4 class="metadata-section-title">Account Members</h4>
										<div class="metadata-members-list">
											${sortedAccountMembers.map(member => {
												const isEveryone = member.id === 'everyone';
												const isAdmin = member.role?.toLowerCase() === 'admin';
												const roleClass = member.role?.toLowerCase() || 'member';
												return `
													<div class="metadata-member-item ${isEveryone ? 'everyone' : ''} ${isAdmin ? 'admin' : ''}">
														<div class="metadata-member-info">
															<span class="metadata-member-id">${isEveryone ? 'Everyone' : truncate(member.id, 16)}</span>
														</div>
														<span class="badge badge-role badge-${roleClass}">${member.role || 'member'}</span>
													</div>
												`;
											}).join('')}
										</div>
									</div>
								` : ''}
								${groupInfo.groupMembers && groupInfo.groupMembers.length > 0 ? `
									<div class="metadata-section">
										<h4 class="metadata-section-title">Group Members</h4>
										<div class="metadata-members-list">
											${groupInfo.groupMembers.map(member => {
												const roleClass = member.role?.toLowerCase() || 'admin';
												return `
													<div class="metadata-member-item">
														<div class="metadata-member-info">
															<code class="metadata-member-id co-id" onclick="selectCoValue('${member.id}')" title="${member.id}">${truncate(member.id, 16)}</code>
														</div>
														<span class="badge badge-role badge-${roleClass}">${member.role || 'admin'}</span>
													</div>
												`;
											}).join('')}
										</div>
									</div>
								` : ''}
							</div>
						` : `
							<div class="metadata-empty">No member information available for this group.</div>
						`
					) : ''}
				</div>
			</aside>
		`;
	}
	
	// Build sidebar navigation items (Account only - no vibes)
	const sidebarItems = navigationItems.map(item => {
		// Account navigation - select account CoValue
		const isActive = currentContextCoValueId === item.id || (currentView === 'account' && !currentContextCoValueId);
		
		const clickHandler = `onclick="selectCoValue('${item.id}')"`;
		
		return `
			<div class="sidebar-item ${isActive ? 'active' : ''}" ${clickHandler}>
				<div class="sidebar-label">
					<span class="sidebar-name">${item.label}</span>
					${item.count !== undefined ? `<span class="sidebar-count">${item.count}</span>` : ''}
				</div>
			</div>
		`;
	}).join('');

	document.getElementById("app").innerHTML = `
		<div class="db-container">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>Maia DB</h1>
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
			
			<div class="db-layout">
				<aside class="db-sidebar">
					<div class="sidebar-content-inner">
						<div class="sidebar-header">
							<h3>Navigation</h3>
						</div>
						<div class="sidebar-content">
							${sidebarItems}
						</div>
					</div>
				</aside>
				
				<main class="db-main">
					<div class="inspector">
						<div class="inspector-content-inner">
							<div class="inspector-header">
								<div class="flex items-center gap-3 flex-grow">
									${currentContextCoValueId && data?.id ? `
										<code class="co-id-header">${truncate(data.id, 32)}</code>
									` : `
										<h2>${viewTitle}</h2>
									`}
									${headerInfo ? `
										<span class="badge badge-type badge-${headerInfo.type} text-[10px] px-2 py-1 font-bold uppercase tracking-widest rounded-lg border border-white/50 shadow-sm">${headerInfo.typeLabel}</span>
										<span class="text-sm font-semibold text-marine-blue">${headerInfo.itemCount} ${headerInfo.itemCount === 1 ? 'Item' : 'Items'}</span>
										<span class="text-xs text-marine-blue-light font-medium italic">${headerInfo.description}</span>
									` : ''}
									${!headerInfo && data?.type ? `
										<span class="badge badge-type badge-${String(data.type || 'comap').replace(/-/g, '')} text-[10px] px-2 py-1 font-bold uppercase tracking-widest rounded-lg border border-white/50 shadow-sm">${data.type === 'colist' ? 'COLIST' : data.type === 'costream' ? 'COSTREAM' : String(data.type || 'COMAP').toUpperCase()}</span>
									` : ''}
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
			
			<!-- Bottom navbar area for mobile -->
			<div class="bottom-navbar">
				<div class="bottom-navbar-left">
					<button class="sidebar-toggle-btn sidebar-toggle-left" onclick="window.toggleDBLeftSidebar()" aria-label="Toggle navigation sidebar">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="3" y1="12" x2="21" y2="12"></line>
							<line x1="3" y1="6" x2="21" y2="6"></line>
							<line x1="3" y1="18" x2="21" y2="18"></line>
						</svg>
					</button>
					${currentContextCoValueId ? `
						<button class="back-btn bottom-back-btn" onclick="goBack()" title="Back in navigation">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M19 12H5M12 19l-7-7 7-7"/>
							</svg>
							<span class="back-label">Back</span>
						</button>
					` : ''}
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
					<button class="sidebar-toggle-btn sidebar-toggle-right" onclick="window.toggleDBRightSidebar()" aria-label="Toggle detail sidebar">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"></circle>
							<path d="M12 16v-4M12 8h.01"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	`;
	
	// Add sidebar toggle handlers for DB viewer
	setTimeout(() => {
		// Ensure sidebars are initialized with collapsed class by default
		// Don't add sidebar-ready class initially to prevent ghost animations
		const leftSidebar = document.querySelector('.db-sidebar');
		const rightSidebar = document.querySelector('.db-metadata');
		
		if (leftSidebar) {
			// Start collapsed by default, no transitions
			leftSidebar.classList.add('collapsed');
		}
		if (rightSidebar) {
			// Start collapsed by default, no transitions
			rightSidebar.classList.add('collapsed');
		}
	}, 100);
}
