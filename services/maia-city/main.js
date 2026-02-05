/**
 * MaiaCity Inspector - First Principles
 * 
 * STRICT: Requires passkey authentication via WebAuthn PRF
 * 
 * Jazz Lazy-Loading Pattern:
 * - CoValues are only loaded from IndexedDB when referenced by a parent or subscribed to
 * - Seeded CoValues are linked to account.examples so Jazz loads them automatically
 * - No manual re-seeding needed - Jazz handles persistence and loading
 */

import { 
	MaiaOS, 
	signInWithPasskey, 
	signUpWithPasskey, 
	isPRFSupported, 
	subscribeSyncState
} from "@MaiaOS/kernel";
import { getAllVibeRegistries } from "@MaiaOS/vibes";
import { renderApp } from './db-view.js';
import { renderLandingPage } from './landing.js';
import { renderSignInPrompt, renderUnsupportedBrowser } from './signin.js';

let maia;
let currentScreen = 'dashboard'; // Current screen: 'dashboard' | 'db-viewer' | 'vibe-viewer'
let currentView = 'account'; // Current schema filter (default: 'account')
let currentContextCoValueId = null; // Currently loaded CoValue in main context (explorer-style navigation)
let currentVibe = null; // Currently loaded vibe (null = DB view mode, 'todos' = todos vibe, etc.)
let currentVibeContainer = null; // Currently loaded vibe container element (for cleanup on unload)
let navigationHistory = []; // Navigation history stack for back button
let isRendering = false; // Guard to prevent render loops
let authState = {
	signedIn: false,
	accountID: null,
};

// Sync state
let syncState = {
	connected: false,
	syncing: false,
	error: null,
};

// Subscription management for sync state
let unsubscribeSync = null;
let syncStateRenderTimeout = null; // Debounce sync state renders

// Check if user has previously authenticated (localStorage flag only, no secrets)
const HAS_ACCOUNT_KEY = 'maia_has_account';

function hasExistingAccount() {
	return localStorage.getItem(HAS_ACCOUNT_KEY) === 'true';
}

function markAccountExists() {
	localStorage.setItem(HAS_ACCOUNT_KEY, 'true');
}

function clearAccountFlag() {
	localStorage.removeItem(HAS_ACCOUNT_KEY);
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info'
 * @param {number} duration - Duration in ms (default: 5000)
 */
function showToast(message, type = 'info', duration = 5000) {
	const icons = {
		success: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
			<path d="M8 12.5L10.5 15L16 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>`,
		error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
			<path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			<circle cx="12" cy="16" r="1" fill="currentColor"/>
		</svg>`,
		info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
			<path d="M12 12V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			<circle cx="12" cy="8" r="1" fill="currentColor"/>
		</svg>`
	};
	
	const titles = {
		success: 'Success',
		error: 'Authentication Failed',
		info: 'Info'
	};
	
	const toast = document.createElement('div');
	toast.className = `toast ${type}`;
	toast.innerHTML = `
		<div class="toast-content">
			<div class="toast-icon">${icons[type]}</div>
			<div class="toast-message">
				<div class="toast-title">${titles[type]}</div>
				${message}
			</div>
		</div>
	`;
	
	document.body.appendChild(toast);
	
	// Auto-remove after duration
	setTimeout(() => {
		toast.classList.add('removing');
		setTimeout(() => {
			document.body.removeChild(toast);
		}, 300); // Match animation duration
	}, duration);
}

/**
 * Navigation helper function
 */
function navigateTo(path) {
	try {
		window.history.pushState({}, '', path);
		handleRoute().catch((error) => {
			console.error("Route handling error:", error);
			showToast("Navigation error: " + error.message, 'error');
		});
	} catch (error) {
		console.error("Navigation error:", error);
		showToast("Navigation error: " + error.message, 'error');
	}
}

/**
 * Handle route changes
 */
async function handleRoute() {
	const path = window.location.pathname;
	console.log(`📍 [ROUTE] Handling route: ${path}`);
	console.log(`   authState.signedIn: ${authState.signedIn}`);
	console.log(`   maia: ${maia ? 'ready' : 'not ready'}`);
	
	if (path === '/signin' || path === '/signup') {
		// If already signed in, redirect to dashboard
		if (authState.signedIn && maia) {
			console.log("   → Already signed in, redirecting to /me");
			navigateTo('/me');
			return;
		}
		// Check PRF support before showing sign-in
		try {
			await isPRFSupported();
			renderSignInPrompt(hasExistingAccount);
		} catch (error) {
			console.error("❌ PRF not supported:", error);
			renderUnsupportedBrowser(error.message);
		}
	} else if (path === '/me' || path === '/dashboard') {
		// If authenticated, show dashboard; otherwise redirect to signin
		if (authState.signedIn && maia) {
			// Both auth state and maia are ready - show dashboard
			console.log("   → Rendering dashboard (both auth and maia ready)");
			try {
				await renderAppInternal();
			} catch (error) {
				console.error("❌ [ROUTE] Error rendering app:", error);
				showToast("Failed to render app: " + error.message, 'error');
			}
		} else if (authState.signedIn && !maia) {
			// Signed in but maia not ready yet - might be initializing
			// Show loading/connecting screen with sync status (prevents redirect loop on mobile)
			console.log("⏳ Auth state says signed in but maia not ready. Waiting for initialization...");
			renderLoadingConnectingScreen();
			// Wait for maia to be initialized (with timeout)
			let waitCount = 0;
			const checkMaia = setInterval(() => {
				waitCount++;
				if (maia) {
					clearInterval(checkMaia);
					cleanupLoadingScreenSync(); // Clean up loading screen sync subscription
					console.log("✅ Maia ready, rendering dashboard");
					renderAppInternal().catch((error) => {
						console.error("❌ [ROUTE] Error rendering app after maia ready:", error);
						showToast("Failed to render app: " + error.message, 'error');
					});
				} else if (waitCount > 20) {
					// 10 seconds timeout (20 * 500ms)
					clearInterval(checkMaia);
					cleanupLoadingScreenSync(); // Clean up loading screen sync subscription
					console.error("❌ Maia still not ready after 10s. Something went wrong.");
					authState = { signedIn: false, accountID: null };
					navigateTo('/signin');
				} else {
					// Update loading screen with current sync status
					updateLoadingConnectingScreen();
				}
			}, 500); // Check every 500ms
		} else {
			// Not signed in - redirect to signin
			console.log("   → Not signed in, redirecting to /signin");
			navigateTo('/signin');
		}
	} else {
		// Default route: landing page
		// If already authenticated, redirect to dashboard
		if (authState.signedIn && maia) {
			console.log("   → Already signed in, redirecting to /me");
			navigateTo('/me');
		} else {
			renderLandingPage();
		}
	}
}

async function init() {
	try {
		// Handle initial route
		await handleRoute();
		
		// Listen for browser back/forward navigation
		window.addEventListener('popstate', () => {
			handleRoute().catch((error) => {
				console.error("Route handling error:", error);
			});
		});
	} catch (error) {
		console.error("Failed to initialize:", error);
		showToast("Failed to initialize: " + error.message, 'error', 10000);
	}
}

/**
 * Determine sync domain from environment (runtime injection or build-time env var)
 * Single source of truth for sync domain configuration
 * In dev mode, returns null (uses relative path via Vite proxy)
 * In production, returns domain or null (fallback to same origin)
 * @returns {string|null} Sync domain or null if not set
 */
function getSyncDomain() {
	const isDev = import.meta.env?.DEV || window.location.hostname === 'localhost';
	
	// In dev mode, we don't need a sync domain - Vite proxy handles it
	if (isDev) {
		return null; // Dev mode uses relative path /sync (proxied by Vite)
	}
	
	// In production, try to get sync domain from env vars
	// Priority: 1) Runtime-injected (from server.js), 2) Build-time env var, 3) null
	const runtimeDomain = typeof window !== 'undefined' && window.__PUBLIC_API_DOMAIN__;
	const buildTimeDomain = import.meta.env?.PUBLIC_API_DOMAIN;
	return runtimeDomain || buildTimeDomain || null;
}

/**
 * Sign in with existing passkey
 */
async function signIn() {
	try {
		console.log("🔐 Starting sign-in flow...");
		
		// Determine sync domain (single source of truth - passed through kernel)
		const syncDomain = getSyncDomain();
		if (syncDomain) {
			console.log(`🔌 [SYNC] Using sync domain: ${syncDomain}`);
		} else {
			console.warn('⚠️ [SYNC] Sync domain not set - will use fallback');
		}
		
		console.log("⏳ Calling signInWithPasskey()...");
		const signInResult = await signInWithPasskey({ 
			salt: "maia.city"
		});
		console.log("✅ signInWithPasskey() returned successfully");
		console.log("   Result keys:", Object.keys(signInResult));
		const { accountID, node, account } = signInResult;
		console.log("✅ Sign-in authentication successful, booting MaiaOS...");
		console.log(`   accountID: ${accountID}`);
		console.log(`   node: ${node ? 'ready' : 'not ready'}`);
		console.log(`   account: ${account ? 'ready' : 'not ready'}`);
		
		// Boot MaiaOS with node, account, and sync domain (using CoJSON backend)
		// Sync domain stored in kernel as single source of truth
		// This must succeed before we mark as signed in
		try {
			maia = await MaiaOS.boot({ 
				node, 
				account,
				syncDomain // Pass sync domain to kernel (single source of truth)
			});
			window.maia = maia;
			console.log("✅ MaiaOS booted successfully");
		} catch (bootError) {
			console.error("❌ MaiaOS.boot() failed:", bootError);
			throw new Error(`Failed to initialize MaiaOS: ${bootError.message}`);
		}
		
		// Set auth state AFTER maia is successfully booted
		authState = {
			signedIn: true,
			accountID: accountID,
		};
		
		// Mark that user has successfully authenticated
		markAccountExists();
		
		// Subscribe to sync state changes
		try {
			unsubscribeSync = subscribeSyncState((state) => {
				// Only update if state actually changed
				const stateChanged = JSON.stringify(syncState) !== JSON.stringify(state);
				syncState = state;
				
				// Debounce re-renders to prevent loops
				if (stateChanged && !isRendering) {
					if (syncStateRenderTimeout) {
						clearTimeout(syncStateRenderTimeout);
					}
					syncStateRenderTimeout = setTimeout(() => {
						if (!isRendering) {
							renderAppInternal(); // Re-render when sync state changes
						}
					}, 100); // Small debounce
				}
			});
		} catch (syncError) {
			console.error("⚠️ Sync subscription failed (non-fatal):", syncError);
		}
		
		// Start with dashboard screen (don't set default context)
		currentScreen = 'dashboard';
		currentContextCoValueId = null;
		
		// Navigate to /me IMMEDIATELY - don't wait for data loading
		// This ensures UI shows right away, especially important on mobile
		console.log("🚀 Navigating to /me...");
		console.log(`   authState.signedIn: ${authState.signedIn}`);
		console.log(`   maia: ${maia ? 'ready' : 'not ready'}`);
		
		// Update URL first
		window.history.pushState({}, '', '/me');
		
		// Then handle route (which will render the app)
		handleRoute().catch((error) => {
			console.error("❌ [SIGNIN] Route handling error:", error);
			showToast("Navigation error: " + error.message, 'error');
		});
		
		// Load linked CoValues in background (non-blocking)
		// This allows the UI to show immediately while data loads progressively
		loadLinkedCoValues().catch((error) => {
			console.error("⚠️ Failed to load linked CoValues (non-fatal):", error);
			// Non-fatal - UI is already shown, data will load progressively via sync
		});
		
	} catch (error) {
		console.error("❌ Sign in failed:", error);
		
		// Reset state on error to prevent stuck state
		authState = { signedIn: false, accountID: null };
		maia = null;
		
		if (error.message.includes("PRF not supported") || error.message.includes("WebAuthn")) {
			renderUnsupportedBrowser(error.message);
		} else if (error.name === 'NotAllowedError' ||
		           error.message.includes("User denied permission") || 
		           error.message.includes("denied permission")) {
			showToast("You cancelled the passkey prompt. Click the button again when you're ready.", 'info', 5000);
			renderSignInPrompt(hasExistingAccount);
		} else {
			const friendlyMessage = error.message.includes("Failed to evaluate PRF") 
				? "Unable to authenticate with your passkey. Please try again."
				: error.message;
			showToast(friendlyMessage, 'error', 7000);
			renderSignInPrompt(hasExistingAccount);
		}
	}
}

/**
 * Load linked CoValues from account
 * 
 * Uses maia.db() operations API with deep resolution to automatically load nested CoValues.
 * Deep resolution ensures all referenced CoValues are loaded progressively.
 */
async function loadLinkedCoValues() {
	if (!maia) {
		return;
	}
	
	try {
		const account = maia.id.maiaId;
		// Read account using operations API
		const accountStore = await maia.db({op: 'read', schema: '@account', key: account.id});
		const accountData = accountStore.value || accountStore;
		
		// Load account.vibes and its referenced vibe CoValues with deep resolution
		if (accountData && accountData.vibes && typeof accountData.vibes === 'string' && accountData.vibes.startsWith('co_')) {
			const vibesId = accountData.vibes;
			// Use deepResolve to automatically load nested CoValues
			await maia.db({op: 'read', schema: vibesId, key: vibesId, deepResolve: true});
			// Deep resolution automatically loads all referenced vibe CoValues
		}
	} catch (error) {
		console.error("   ❌ Failed to load linked CoValues:", error);
	}
}


/**
 * Register new passkey
 */
async function register() {
	try {
		console.log("🔐 Starting sign-up flow...");
		
		// Determine sync domain (single source of truth - passed through kernel)
		const syncDomain = getSyncDomain();
		const isDev = import.meta.env?.DEV || window.location.hostname === 'localhost';
		if (syncDomain) {
			console.log(`🔌 [SYNC] Using sync domain: ${syncDomain}`);
		} else if (!isDev) {
			// Only warn in production if sync domain is not set
			console.warn('⚠️ [SYNC] Sync domain not set in production - will use fallback');
		}
		
		const { accountID, node, account } = await signUpWithPasskey({ 
			name: "maia",
			salt: "maia.city"
		});
		console.log("✅ Sign-up authentication successful, booting MaiaOS...");
		
		// Boot MaiaOS with node, account, and sync domain (using CoJSON backend)
		// Sync domain stored in kernel as single source of truth
		// This must succeed before we mark as signed in
		try {
			maia = await MaiaOS.boot({ 
				node, 
				account,
				syncDomain, // Pass sync domain to kernel (single source of truth)
				modules: ['db', 'core', 'private-llm'] // Include private-llm module for RedPill chat
			});
			window.maia = maia;
			console.log("✅ MaiaOS booted successfully");
		} catch (bootError) {
			console.error("❌ MaiaOS.boot() failed:", bootError);
			throw new Error(`Failed to initialize MaiaOS: ${bootError.message}`);
		}
		
		// Set auth state AFTER maia is successfully booted
		authState = {
			signedIn: true,
			accountID: accountID,
		};
		
		// Mark that user has successfully registered
		markAccountExists();
		
		// Subscribe to sync state changes
		try {
			unsubscribeSync = subscribeSyncState((state) => {
				// Only update if state actually changed
				const stateChanged = JSON.stringify(syncState) !== JSON.stringify(state);
				syncState = state;
				
				// Debounce re-renders to prevent loops
				if (stateChanged && !isRendering) {
					if (syncStateRenderTimeout) {
						clearTimeout(syncStateRenderTimeout);
					}
					syncStateRenderTimeout = setTimeout(() => {
						if (!isRendering) {
							renderAppInternal(); // Re-render when sync state changes
						}
					}, 100); // Small debounce
				}
			});
		} catch (syncError) {
			console.error("⚠️ Sync subscription failed (non-fatal):", syncError);
		}

		// Start with dashboard screen (don't set default context)
		currentScreen = 'dashboard';
		currentContextCoValueId = null;

		// Navigate to /me IMMEDIATELY - don't wait for data loading
		// This ensures UI shows right away, especially important on mobile
		console.log("🚀 Navigating to /me...");
		console.log(`   authState.signedIn: ${authState.signedIn}`);
		console.log(`   maia: ${maia ? 'ready' : 'not ready'}`);
		
		// Update URL first
		window.history.pushState({}, '', '/me');
		
		// Then handle route (which will render the app)
		handleRoute().catch((error) => {
			console.error("❌ [REGISTER] Route handling error:", error);
			showToast("Navigation error: " + error.message, 'error');
		});
		
		// Load linked CoValues in background (non-blocking)
		// This allows the UI to show immediately while data loads progressively
		loadLinkedCoValues().catch((error) => {
			console.error("⚠️ Failed to load linked CoValues (non-fatal):", error);
			// Non-fatal - UI is already shown, data will load progressively via sync
		});
		
	} catch (error) {
		console.error("Registration failed:", error);
		
		if (error.message.includes("PRF not supported") || error.message.includes("WebAuthn")) {
			renderUnsupportedBrowser(error.message);
		} else if (error.name === 'NotAllowedError' ||
		           error.message.includes("User denied permission") || 
		           error.message.includes("denied permission")) {
			showToast("You cancelled the passkey prompt. Click the button again when you're ready.", 'info', 5000);
			renderSignInPrompt(hasExistingAccount);
		} else {
			const friendlyMessage = error.message.includes("Failed to create passkey")
				? "Unable to create passkey. Please try again."
				: error.message;
			showToast(friendlyMessage, 'error', 7000);
			renderSignInPrompt(hasExistingAccount);
		}
	}
}

function signOut() {
	// Signing out
	if (unsubscribeSync) {
		unsubscribeSync();
		unsubscribeSync = null;
	}
	authState = { signedIn: false, accountID: null };
	syncState = { connected: false, syncing: false, error: null };
	maia = null;
	
	// DON'T clear the account flag - passkey still exists on device!
	// User can still sign back in, so UI should show "Sign In" as primary
	window.location.reload();
}


// Store loading screen sync subscription
let loadingScreenSyncUnsubscribe = null;

/**
 * Render loading/connecting screen while MaiaOS initializes
 * Shows app structure with loading overlay and sync status
 * Sets up sync state listener to update the screen in real-time
 */
function renderLoadingConnectingScreen() {
	const syncMessage = syncState.connected 
		? 'Connected' 
		: syncState.error 
			? syncState.error 
			: 'Connecting to sync...';
	
	document.getElementById("app").innerHTML = `
		<div class="app-container" style="opacity: 0.5; pointer-events: none;">
			<!-- Show app structure (dashboard skeleton) -->
			<div class="dashboard-container">
				<div class="dashboard-header">
					<h1>Maia City</h1>
				</div>
				<div class="dashboard-grid">
					<div class="dashboard-card whitish-card">
						<div class="dashboard-card-content">
							<div class="dashboard-card-icon">📊</div>
							<h3 class="dashboard-card-title">Loading...</h3>
						</div>
					</div>
					<div class="dashboard-card whitish-card">
						<div class="dashboard-card-content">
							<div class="dashboard-card-icon">📋</div>
							<h3 class="dashboard-card-title">Loading...</h3>
						</div>
					</div>
				</div>
			</div>
		</div>
		<!-- Loading/Connecting Overlay -->
		<div class="loading-connecting-overlay" style="
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.85);
			backdrop-filter: blur(10px);
			display: flex;
			align-items: center;
			justify-content: center;
			flex-direction: column;
			gap: 2rem;
			z-index: 1000;
		">
			<div class="loading-spinner" style="
				width: 64px;
				height: 64px;
				border: 4px solid rgba(255, 255, 255, 0.2);
				border-top-color: rgba(255, 255, 255, 0.8);
				border-radius: 50%;
				animation: spin 1s linear infinite;
			"></div>
			<div style="text-align: center; color: white;">
				<h2 style="font-size: 1.5rem; margin: 0 0 0.5rem 0; font-weight: 600;">Initializing your account</h2>
				<div style="font-size: 1rem; opacity: 0.8; margin-bottom: 1rem;">Setting up your sovereign self...</div>
				<div class="sync-status" style="
					display: inline-flex;
					align-items: center;
					gap: 0.5rem;
					padding: 0.5rem 1rem;
					background: rgba(255, 255, 255, 0.1);
					border-radius: 8px;
					font-size: 0.875rem;
					margin-top: 1rem;
				">
					<div class="sync-indicator" style="
						width: 8px;
						height: 8px;
						border-radius: 50%;
						background: ${syncState.connected ? '#4ade80' : syncState.error ? '#ef4444' : '#fbbf24'};
						animation: ${syncState.connected ? 'none' : 'pulse 2s ease-in-out infinite'};
					"></div>
					<span class="sync-message">${syncMessage}</span>
				</div>
			</div>
		</div>
		<style>
			@keyframes spin {
				to { transform: rotate(360deg); }
			}
			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.5; }
			}
		</style>
	`;
	
	// Set up sync state listener to update loading screen in real-time
	if (!loadingScreenSyncUnsubscribe) {
		loadingScreenSyncUnsubscribe = subscribeSyncState((state) => {
			syncState = state;
			updateLoadingConnectingScreen();
		});
	}
}

/**
 * Update loading/connecting screen with current sync status
 */
function updateLoadingConnectingScreen() {
	const syncStatusElement = document.querySelector('.sync-status');
	const syncIndicator = document.querySelector('.sync-indicator');
	const syncMessageElement = document.querySelector('.sync-message');
	const syncMessage = syncState.connected 
		? 'Connected' 
		: syncState.error 
			? syncState.error 
			: 'Connecting to sync...';
	
	if (syncStatusElement && syncIndicator && syncMessageElement) {
		syncMessageElement.textContent = syncMessage;
		syncIndicator.style.background = syncState.connected 
			? '#4ade80' 
			: syncState.error 
				? '#ef4444' 
				: '#fbbf24';
		syncIndicator.style.animation = syncState.connected 
			? 'none' 
			: 'pulse 2s ease-in-out infinite';
	}
}

/**
 * Clean up loading screen sync subscription
 */
function cleanupLoadingScreenSync() {
	if (loadingScreenSyncUnsubscribe) {
		loadingScreenSyncUnsubscribe();
		loadingScreenSyncUnsubscribe = null;
	}
}


/**
 * Handle seed button click - reseed database (idempotent: preserves schemata, recreates configs/data)
 */
async function handleSeed() {
	if (!maia || !maia.id) {
		showToast("Please sign in first", 'error', 3000);
		return;
	}
	
	try {
		showToast("🌱 Reseeding database (preserving schemata)...", 'info', 2000);
		
		// Get node and account from maia
		const { node, maiaId: account } = maia.id;
		
		// Automatically discover and import all vibe registries
		const vibeRegistries = await getAllVibeRegistries();
		
		console.log(`[Seed] Found ${vibeRegistries.length} vibe registries:`, vibeRegistries.map(r => r.vibe?.$id || r.vibe?.name || 'unknown'));
		
		if (vibeRegistries.length === 0) {
			showToast("No vibe registries found to seed", 'warning', 3000);
			return;
		}
		
		// Merge all configs from all vibes
		const mergedConfigs = {
			styles: {},
			actors: {},
			views: {},
			contexts: {},
			states: {},
			inboxes: {},
			vibes: vibeRegistries.map(r => r.vibe), // Pass vibes as array
			data: {}
		};
		
		// Merge configs from all vibe registries
		for (const registry of vibeRegistries) {
			Object.assign(mergedConfigs.styles, registry.styles || {});
			Object.assign(mergedConfigs.actors, registry.actors || {});
			Object.assign(mergedConfigs.views, registry.views || {});
			Object.assign(mergedConfigs.contexts, registry.contexts || {});
			Object.assign(mergedConfigs.states, registry.states || {});
			Object.assign(mergedConfigs.inboxes, registry.inboxes || {});
			Object.assign(mergedConfigs.data, registry.data || {});
		}
		
		// Single seed call - seed function handles everything
		maia = await MaiaOS.boot({ 
			node, 
			account,
			modules: ['db', 'core', 'private-llm'], // Include private-llm module for RedPill chat
			registry: mergedConfigs
		});
		
		
		// Reload linked CoValues to see seeded data
		await loadLinkedCoValues();
		
		// Re-render
		renderAppInternal();
		
		showToast("✅ Database reseeded successfully!", 'success', 3000);
	} catch (error) {
		console.error("Seeding failed:", error);
		showToast(`Seeding failed: ${error.message}`, 'error', 5000);
	}
}

// Expose globally for onclick handlers
window.handleSignIn = signIn;
window.handleRegister = register;
window.navigateTo = navigateTo;
window.handleSignOut = signOut;
window.handleSeed = handleSeed;
window.showToast = showToast; // Expose for debugging

// Navigation function for screen transitions
function navigateToScreen(screen) {
	currentScreen = screen;
	if (screen === 'dashboard') {
		currentVibe = null;
		currentContextCoValueId = null;
		navigationHistory = [];
	}
	renderAppInternal();
}

// switchView moved above selectCoValue

function selectCoValue(coId, skipHistory = false) {
	// Collapse sidebars when selecting a co-value
	collapseAllSidebars();
	
	// If we're in vibe mode and selecting account, exit vibe mode first
	if (currentVibe !== null && coId === maia?.id?.maiaId?.id) {
		currentVibe = null;
		// If there's navigation history, restore the previous context instead of going to account
		if (navigationHistory.length > 0) {
			const previousCoId = navigationHistory.pop();
			currentContextCoValueId = previousCoId;
			renderAppInternal();
			return;
		}
	}

	// Add current context to navigation history (unless we're going back or it's null)
	if (!skipHistory && currentContextCoValueId !== null && currentContextCoValueId !== coId) {
		navigationHistory.push(currentContextCoValueId);
	}

	// Explorer-style navigation: load CoValue into main container context
	currentContextCoValueId = coId;
	currentScreen = 'db-viewer'; // Navigate to DB viewer when selecting a CoValue
	renderAppInternal();
	// read() API in db-view.js handles loading and reactivity automatically
}

/**
 * Collapse all sidebars (both DB viewer and vibe viewer)
 */
function collapseAllSidebars() {
	// Collapse DB viewer sidebars
	const dbSidebar = document.querySelector('.db-sidebar');
	const dbMetadata = document.querySelector('.db-metadata');
	if (dbSidebar) {
		dbSidebar.classList.add('collapsed');
	}
	if (dbMetadata) {
		dbMetadata.classList.add('collapsed');
	}
	
	// Collapse vibe viewer sidebars (in Shadow DOM)
	const vibeContainer = document.querySelector('.vibe-container');
	if (vibeContainer && vibeContainer.shadowRoot) {
		const navAside = vibeContainer.shadowRoot.querySelector('.nav-aside');
		const detailAside = vibeContainer.shadowRoot.querySelector('.detail-aside');
		if (navAside) {
			navAside.classList.add('collapsed');
		}
		if (detailAside) {
			detailAside.classList.add('collapsed');
		}
	}
}

function goBack() {
	// If we're in vibe mode, exit vibe mode first
	if (currentVibe !== null) {
		loadVibe(null);
		return;
	}
	
	// If we're in db-viewer, navigate back in history or go to dashboard
	if (currentScreen === 'db-viewer') {
		if (navigationHistory.length > 0) {
			const previousCoId = navigationHistory.pop();
			selectCoValue(previousCoId, true); // Skip adding to history
		} else {
			// No history, go to dashboard
			navigateToScreen('dashboard');
		}
	} else {
		// Default: go to dashboard
		navigateToScreen('dashboard');
	}
}

function switchView(view) {
	currentView = view;
	currentContextCoValueId = null; // Reset context when switching views
	navigationHistory = []; // Clear navigation history when switching views
	currentScreen = 'db-viewer'; // Ensure we're in DB viewer when switching views
	renderAppInternal();
}

async function renderAppInternal() {
	// Guard against render loops
	if (isRendering) {
		return;
	}
	
	isRendering = true;
	
	try {
		await renderApp(maia, authState, syncState, currentScreen, currentView, currentContextCoValueId, currentVibe, switchView, selectCoValue, loadVibe, navigateToScreen);
	} finally {
		isRendering = false;
	}
}

// Expose renderAppInternal globally for reactive updates
window.renderAppInternal = renderAppInternal;

/**
 * Load a vibe inline in the main context area
 * @param {string|null} vibeKey - Vibe key (e.g., 'todos') or null to exit vibe mode
 */
async function loadVibe(vibeKey) {
	if (!maia && vibeKey !== null) {
		console.error('[MaiaCity] Cannot load vibe - MaiaOS not initialized');
		return;
	}
	
	// Ensure vibeKey is a string or null (not a function)
	if (vibeKey !== null && typeof vibeKey !== 'string') {
		console.error(`[MaiaCity] Invalid vibeKey type: expected string or null, got ${typeof vibeKey}`, vibeKey);
		return;
	}
	
	try {
		if (vibeKey === null) {
			// Unloading vibe - detach actors (keep alive for reuse)
			// Use vibe-based tracking instead of container-based
			if (currentVibe && maia && maia.actorEngine) {
				maia.actorEngine.detachActorsForVibe(currentVibe);
			}
			
			// Clear container reference
			currentVibeContainer = null;
			window.currentVibeContainer = null;
			
			currentVibe = null;
			// Navigate back to dashboard when exiting vibe
			navigateToScreen('dashboard');
		} else {
			// Detach actors from previous vibe BEFORE switching (if switching vibes)
			if (currentVibe && currentVibe !== vibeKey && maia && maia.actorEngine) {
				console.log(`[MaiaCity] Detaching actors from previous vibe: ${currentVibe}`);
				maia.actorEngine.detachActorsForVibe(currentVibe);
			}
			
			// Save current context to history before entering vibe mode
			if (currentContextCoValueId !== null) {
				navigationHistory.push(currentContextCoValueId);
			}
			// Set current vibe state and navigate to vibe viewer
			currentVibe = vibeKey;
			currentContextCoValueId = null; // Clear DB context
			currentScreen = 'vibe-viewer';
		}
		
		// Re-render to show vibe content or return to dashboard
		await renderAppInternal();
	} catch (error) {
		console.error(`[MaiaCity] Failed to load vibe ${vibeKey}:`, error);
		currentVibe = null;
		await renderAppInternal();
	}
}

function toggleExpand(expandId) {
	const element = document.getElementById(expandId);
	
	if (element) {
		const isExpanded = element.style.display !== 'none';
		element.style.display = isExpanded ? 'none' : 'block';
		
		// Rotate the expand icon - need to find it in the button
		const wrapper = element.parentElement;
		const button = wrapper?.querySelector('button');
		const icon = button?.querySelector('.expand-icon');
		
		if (icon) {
			icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
		}
	}
}

/**
 * Debug helper function for inspecting todos state
 * Exposed as window.debugTodos() for console access
 */
window.debugTodos = async function() {
	if (!maia) {
		console.error('[debugTodos] MaiaOS not initialized');
		return;
	}
	
	console.log('=== TODOS DEBUG INFO ===');
	
	// Find todos-related actors
	const actorEngine = maia.actorEngine;
	if (!actorEngine) {
		console.error('[debugTodos] ActorEngine not available');
		return;
	}
	
	const actors = actorEngine.getAllActors();
	console.log(`Total actors: ${actors.length}`);
	
	// Find actors with todos context
	const todosActors = [];
	for (const actor of actors) {
		if (actor.context && ('todos' in actor.context || 'todosTodo' in actor.context)) {
			todosActors.push(actor);
		}
	}
	
	console.log(`Actors with todos context: ${todosActors.length}`);
	
	for (const actor of todosActors) {
		console.log(`\n--- Actor ${actor.id.substring(0, 12)}... ---`);
		console.log(`Context keys:`, Object.keys(actor.context));
		
		// Check todos context
		if (actor.context.todos) {
			const todos = actor.context.todos;
			const todosType = Array.isArray(todos) ? `array[${todos.length}]` : typeof todos;
			console.log(`context.todos: ${todosType}`, todos);
		}
		
		if (actor.context.todosTodo) {
			const todosTodo = actor.context.todosTodo;
			const todosTodoType = Array.isArray(todosTodo) ? `array[${todosTodo.length}]` : typeof todosTodo;
			console.log(`context.todosTodo: ${todosTodoType}`, todosTodo);
		}
		
		
		// Check initial data received
		if (actor._initialDataReceived) {
			console.log(`Initial data received:`, Array.from(actor._initialDataReceived));
		}
		
		// Check render state
		console.log(`Initial render complete: ${actor._initialRenderComplete}`);
		console.log(`Needs post-init rerender: ${actor._needsPostInitRerender}`);
	}
	
	// Check todos schema index using operations API (from account.os, not account.data.todos)
	if (maia) {
		try {
			// Get todos schema index colist from account.os (new indexing system)
			const { getSchemaIndexColistId } = await import('@MaiaOS/kernel');
			const backend = maia.dbEngine?.backend;
			const todosSchemaIndexColistId = backend ? await getSchemaIndexColistId(backend, '@schema/data/todos') : null;
			
			if (todosSchemaIndexColistId) {
				console.log(`\n--- Todos Schema Index Colist (from account.os) ---`);
				console.log(`Index Colist ID: ${todosSchemaIndexColistId}`);
				// Use operations API to read the index colist
				const indexStore = await maia.db({op: 'read', schema: todosSchemaIndexColistId, key: todosSchemaIndexColistId});
				const indexData = indexStore.value || indexStore;
				
				if (indexData && !indexData.error && !indexData.loading) {
					console.log(`Index Colist available: true`);
					// Operations API returns items array for colists
					const items = indexData.items || [];
					console.log(`Indexed todo IDs: ${items.length} items`, items);
					
					// Check each item using operations API
					for (const itemId of items) {
						if (typeof itemId === 'string' && itemId.startsWith('co_')) {
							try {
								const itemStore = await maia.db({op: 'read', schema: itemId, key: itemId});
								const itemData = itemStore.value || itemStore;
								const itemAvailable = !itemData.error && !itemData.loading;
								console.log(`  Todo ${itemId.substring(0, 12)}...: available=${itemAvailable}`);
							} catch (itemError) {
								console.log(`  Todo ${itemId.substring(0, 12)}...: error loading - ${itemError.message}`);
							}
						}
					}
				} else {
					console.log(`Index Colist not available or still loading`);
				}
			} else {
				console.log(`\nTodos schema index colist not found in account.os (schema may not be registered yet)`);
			}
		} catch (error) {
			console.error('[debugTodos] Error checking backend:', error);
		}
	}
	
	console.log('\n=== END DEBUG INFO ===');
};

// Expose globally for onclick handlers
window.switchView = switchView;
window.selectCoValue = selectCoValue;
window.goBack = goBack;
window.loadVibe = loadVibe;
window.navigateToScreen = navigateToScreen;
window.toggleExpand = toggleExpand;

// Mobile menu toggle
window.toggleMobileMenu = function() {
	const menu = document.getElementById('mobile-menu');
	if (menu) {
		menu.classList.toggle('active');
		const hamburger = document.querySelector('.hamburger-btn');
		if (hamburger) {
			hamburger.classList.toggle('active');
		}
	}
};


// Toggle DB viewer left sidebar (navigation)
window.toggleDBLeftSidebar = function() {
	const sidebar = document.querySelector('.db-sidebar');
	if (sidebar) {
		// Enable transitions when user explicitly toggles
		sidebar.classList.add('sidebar-ready');
		sidebar.classList.toggle('collapsed');
		// Also collapse right sidebar when opening left (optional - can remove if you want both open)
		const rightSidebar = document.querySelector('.db-metadata');
		if (rightSidebar && !sidebar.classList.contains('collapsed')) {
			rightSidebar.classList.add('sidebar-ready');
			rightSidebar.classList.add('collapsed');
		}
	}
};

// Toggle DB viewer right sidebar (metadata)
window.toggleDBRightSidebar = function() {
	const sidebar = document.querySelector('.db-metadata');
	if (sidebar) {
		// Enable transitions when user explicitly toggles
		sidebar.classList.add('sidebar-ready');
		sidebar.classList.toggle('collapsed');
		// Also collapse left sidebar when opening right (optional - can remove if you want both open)
		const leftSidebar = document.querySelector('.db-sidebar');
		if (leftSidebar && !sidebar.classList.contains('collapsed')) {
			leftSidebar.classList.add('sidebar-ready');
			leftSidebar.classList.add('collapsed');
		}
	}
};

// Toggle vibe viewer left sidebar (navigation)
window.toggleLeftSidebar = function() {
	const vibeContainer = document.querySelector('.vibe-container');
	if (vibeContainer && vibeContainer.shadowRoot) {
		const navAside = vibeContainer.shadowRoot.querySelector('.nav-aside');
		if (navAside) {
			// Enable transitions when user explicitly toggles
			navAside.classList.add('sidebar-ready');
			navAside.classList.toggle('collapsed');
			// Also collapse right sidebar when opening left
			const detailAside = vibeContainer.shadowRoot.querySelector('.detail-aside');
			if (detailAside && !navAside.classList.contains('collapsed')) {
				detailAside.classList.add('sidebar-ready');
				detailAside.classList.add('collapsed');
			}
		}
	}
};

// Toggle vibe viewer right sidebar (detail)
window.toggleRightSidebar = function() {
	const vibeContainer = document.querySelector('.vibe-container');
	if (vibeContainer && vibeContainer.shadowRoot) {
		const detailAside = vibeContainer.shadowRoot.querySelector('.detail-aside');
		if (detailAside) {
			// Enable transitions when user explicitly toggles
			detailAside.classList.add('sidebar-ready');
			detailAside.classList.toggle('collapsed');
			// Also collapse left sidebar when opening right
			const navAside = vibeContainer.shadowRoot.querySelector('.nav-aside');
			if (navAside && !detailAside.classList.contains('collapsed')) {
				navAside.classList.add('sidebar-ready');
				navAside.classList.add('collapsed');
			}
		}
	}
};

init();
