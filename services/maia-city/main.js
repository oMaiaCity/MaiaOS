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

import { MaiaOS, signInWithPasskey, signUpWithPasskey, isPRFSupported, subscribeSyncState } from "@MaiaOS/kernel";
import { createCoJSONAPI } from "@MaiaOS/db";
import { renderApp } from './db-view.js';

let maia;
let cojsonAPI = null; // CoJSON API instance
let currentView = 'account'; // Current schema filter (default: 'account')
let currentContextCoValueId = null; // Currently loaded CoValue in main context (explorer-style navigation)
let currentVibe = null; // Currently loaded vibe (null = DB view mode, 'todos' = todos vibe, etc.)
let currentVibeContainer = null; // Currently loaded vibe container element (for cleanup on unload)
let navigationHistory = []; // Navigation history stack for back button
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

// Subscription management for ReactiveStore updates
let activeStoreSubscriptions = new Map(); // coId/queryKey → unsubscribe function
let unsubscribeSync = null;

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

async function init() {
	try {
		// STRICT: Check PRF support first
		try {
			await isPRFSupported();
		} catch (error) {
			console.error("❌ PRF not supported:", error);
			renderUnsupportedBrowser(error.message);
			return;
		}
		
		// Show sign-in prompt (no localStorage check)
		renderSignInPrompt();
	} catch (error) {
		console.error("Failed to initialize:", error);
		showToast("Failed to initialize: " + error.message, 'error', 10000);
	}
}

/**
 * Sign in with existing passkey
 */
async function signIn() {
	try {
		const { accountID, node, account } = await signInWithPasskey({ salt: "maia.city" });
		
		// Boot MaiaOS with node and account (using CoJSON backend)
		maia = await MaiaOS.boot({ node, account });
		window.maia = maia;
		
		// Create CoJSON API instance
		cojsonAPI = createCoJSONAPI(node, account);
		window.cojsonAPI = cojsonAPI; // Expose for debugging
		
		authState = {
			signedIn: true,
			accountID: accountID,
		};
		
		// Mark that user has successfully authenticated
		markAccountExists();
		
		// Subscribe to sync state changes
		unsubscribeSync = subscribeSyncState((state) => {
			syncState = state;
			renderAppInternal(); // Re-render when sync state changes
		});
		
		// Explicitly load linked CoValues from IndexedDB
		await loadLinkedCoValues();
		
		// Set account as default context
		if (maia && maia.id && maia.id.maiaId) {
			currentContextCoValueId = maia.id.maiaId.id;
		}
		
		renderAppInternal();
		
	} catch (error) {
		console.error("Sign in failed:", error);
		
		if (error.message.includes("PRF not supported") || error.message.includes("WebAuthn")) {
			renderUnsupportedBrowser(error.message);
		} else if (error.name === 'NotAllowedError' ||
		           error.message.includes("User denied permission") || 
		           error.message.includes("denied permission")) {
			showToast("You cancelled the passkey prompt. Click the button again when you're ready.", 'info', 5000);
			renderSignInPrompt();
		} else {
			const friendlyMessage = error.message.includes("Failed to evaluate PRF") 
				? "Unable to authenticate with your passkey. Please try again."
				: error.message;
			showToast(friendlyMessage, 'error', 7000);
			renderSignInPrompt();
		}
	}
}

/**
 * Load linked CoValues from account
 * 
 * Jazz uses lazy-loading - CoValues are only loaded when explicitly requested.
 * This function triggers loading of all CoValues linked to the account.
 */
async function loadLinkedCoValues() {
	const { node, maiaId: account } = maia.id;
	
	
	// Get the examples ID
	const examplesId = account.get("examples");
	if (!examplesId) {
		// No examples linked to account
		return;
	}
	
	// Examples ID available
	
	// Explicitly load the examples CoMap from IndexedDB
	try {
		const examplesCore = await node.loadCoValueCore(examplesId);
		if (examplesCore.isAvailable()) {
			
			// Now load the child CoValues referenced by examples
			const examplesContent = examplesCore.getCurrentContent();
			const childIds = [];
			
			// Get all property values from the examples CoMap
			for (const key of examplesContent.keys()) {
				const childId = examplesContent.get(key);
				if (childId && typeof childId === "string" && childId.startsWith("co_")) {
					childIds.push({ key, id: childId });
				}
			}
			
			// Load each child CoValue
			for (const { key, id } of childIds) {
				await node.loadCoValueCore(id);
			}
		}
	} catch (error) {
		console.error("   ❌ Failed to load examples:", error);
	}
}


/**
 * Register new passkey
 */
async function register() {
	try {
		const { accountID, node, account } = await signUpWithPasskey({ 
			name: "maia",
			salt: "maia.city" 
		});
		
		// Boot MaiaOS with node and account (using CoJSON backend)
		maia = await MaiaOS.boot({ node, account });
		window.maia = maia;
		
		// Create CoJSON API instance
		cojsonAPI = createCoJSONAPI(node, account);
		window.cojsonAPI = cojsonAPI; // Expose for debugging
		
		authState = {
			signedIn: true,
			accountID: accountID,
		};
		
		// Mark that user has successfully registered
		markAccountExists();
		
		// Subscribe to sync state changes
		unsubscribeSync = subscribeSyncState((state) => {
			syncState = state;
			renderAppInternal(); // Re-render when sync state changes
		});

		// Set account as default context
		if (maia && maia.id && maia.id.maiaId) {
			currentContextCoValueId = maia.id.maiaId.id;
		}

		renderAppInternal();
		
	} catch (error) {
		console.error("Registration failed:", error);
		
		if (error.message.includes("PRF not supported") || error.message.includes("WebAuthn")) {
			renderUnsupportedBrowser(error.message);
		} else if (error.name === 'NotAllowedError' ||
		           error.message.includes("User denied permission") || 
		           error.message.includes("denied permission")) {
			showToast("You cancelled the passkey prompt. Click the button again when you're ready.", 'info', 5000);
			renderSignInPrompt();
		} else {
			const friendlyMessage = error.message.includes("Failed to create passkey")
				? "Unable to create passkey. Please try again."
				: error.message;
			showToast(friendlyMessage, 'error', 7000);
			renderSignInPrompt();
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
	cojsonAPI = null;
	
	// DON'T clear the account flag - passkey still exists on device!
	// User can still sign back in, so UI should show "Sign In" as primary
	window.location.reload();
}

function renderSignInPrompt() {
	const hasAccount = hasExistingAccount();
	
	// Rendering sign-in prompt
	
	document.getElementById("app").innerHTML = `
		<div class="sign-in-container">
			<div class="sign-in-content liquid-glass">
				<div class="liquid-glass--bend"></div>
				<div class="liquid-glass--face"></div>
				<div class="liquid-glass--edge"></div>
				<div class="sign-in-inner liquid-glass-inner">
					<div class="logo-container">
						<img src="/brand/logo.svg" alt="Maia City" class="sign-in-logo" />
					</div>
					<h1>
						<span>is where you become</span>
						<span class="h1-main-text">
							<span class="h1-line-1">the human</span>
						</span>
					</h1>
					<p class="sign-in-subtitle">you were always meant to be</p>
					${!hasAccount ? `
						<p class="sign-in-description">
							Create your new sovereign self now. Only you will own and control your maia identity and data.
						</p>
					` : ''}
					<div class="sign-in-buttons">
						${hasAccount ? `
							<button class="sign-in-btn" onclick="window.handleSignIn()">
								Unlock your Self
							</button>
							<button class="sign-in-btn secondary" onclick="window.handleRegister()">
								Create new Self
							</button>
						` : `
							<button class="sign-in-btn" onclick="window.handleRegister()">
								Create new Self
							</button>
							<button class="sign-in-btn secondary" onclick="window.handleSignIn()">
								Unlock your Self
							</button>
						`}
					</div>
				</div>
			</div>
		</div>
	`;
}

function renderUnsupportedBrowser(message) {
	document.getElementById("app").innerHTML = `
		<div class="unsupported-browser">
			<div class="unsupported-content">
				<h1>⚠️ Browser Not Supported</h1>
				<p class="unsupported-message">${message}</p>
				<div class="unsupported-requirements">
					<h3>Please use:</h3>
					<ul>
						<li>✅ Chrome on macOS, Linux, or Windows 11</li>
						<li>✅ Safari on macOS 13+ or iOS 16+</li>
					</ul>
					<h3>Not supported:</h3>
					<ul>
						<li>❌ Firefox (all platforms)</li>
						<li>❌ Windows 10 (any browser)</li>
						<li>❌ Older browsers</li>
					</ul>
				</div>
			</div>
		</div>
	`;
}

/**
 * Handle seed button click - seed database with schemas and configs
 */
async function handleSeed() {
	if (!maia || !maia.id) {
		showToast("Please sign in first", 'error', 3000);
		return;
	}
	
	try {
		showToast("🌱 Seeding database...", 'info', 2000);
		
		// Get node and account from maia
		const { node, maiaId: account } = maia.id;
		
		// Import TodosVibeRegistry to seed vibes
		const { TodosVibeRegistry } = await import('@MaiaOS/vibes/todos/registry.js');
		
		// Boot with registry to trigger seeding (includes vibe)
		maia = await MaiaOS.boot({ 
			node, 
			account,
			registry: TodosVibeRegistry // Include vibe registry for seeding
		});
		
		// Re-create CoJSON API instance
		cojsonAPI = createCoJSONAPI(node, account);
		window.cojsonAPI = cojsonAPI;
		
		// Reload linked CoValues to see seeded data
		await loadLinkedCoValues();
		
		// Re-render
		renderAppInternal();
		
		showToast("✅ Database seeded successfully!", 'success', 3000);
	} catch (error) {
		console.error("Seeding failed:", error);
		showToast(`Seeding failed: ${error.message}`, 'error', 5000);
	}
}

// Expose globally for onclick handlers
window.handleSignIn = signIn;
window.handleRegister = register;
window.handleSignOut = signOut;
window.handleSeed = handleSeed;
window.showToast = showToast; // Expose for debugging

// switchView moved above selectCoValue

function selectCoValue(coId, skipHistory = false) {
	// Clean up old subscriptions when navigating away
	cleanupStoreSubscriptions();

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
	renderAppInternal();

	// If selecting a CoValue, subscribe to its loading state
	if (coId && maia?.id?.node) {
		const coValueCore = maia.id.node.getCoValue(coId);
		if (coValueCore && !coValueCore.isAvailable()) {
			// Subscribe to updates and re-render when available
			const unsubscribe = coValueCore.subscribe((core) => {
				if (core.isAvailable()) {
					renderAppInternal();
					unsubscribe(); // Unsubscribe after first load
				}
			});

			// Trigger loading from IndexedDB
			maia.id.node.loadCoValueCore(coId).catch(err => {
				console.error(`❌ Failed to load ${coId.substring(0, 12)}...`, err);
				renderAppInternal(); // Re-render to show error
			});
		}
	}
}

function goBack() {
	// If we're in vibe mode, exit vibe mode first
	if (currentVibe !== null) {
		loadVibe(null);
		return;
	}
	
	// Navigate back in history
	if (navigationHistory.length > 0) {
		const previousCoId = navigationHistory.pop();
		selectCoValue(previousCoId, true); // Skip adding to history
	} else {
		// No history, go to account root
		const accountId = maia?.id?.maiaId?.id;
		if (accountId) {
			selectCoValue(accountId, true);
		}
	}
}

function switchView(view) {
	// Clean up old subscriptions when switching views
	cleanupStoreSubscriptions();

	currentView = view;
	currentContextCoValueId = null; // Reset context when switching views
	navigationHistory = []; // Clear navigation history when switching views
	renderAppInternal();
}

function cleanupStoreSubscriptions() {
	// Clean up all active ReactiveStore subscriptions
	for (const [key, unsubscribe] of activeStoreSubscriptions.entries()) {
		try {
			unsubscribe();
		} catch (e) {
			console.warn(`[DB Viewer] Error cleaning up subscription for ${key}:`, e);
		}
	}
	activeStoreSubscriptions.clear();
}

async function renderAppInternal() {
	// Register subscription callback to track ReactiveStore subscriptions
	const registerSubscription = (key, unsubscribe) => {
		// Clean up old subscription for this key if it exists
		const oldUnsubscribe = activeStoreSubscriptions.get(key);
		if (oldUnsubscribe) {
			try {
				oldUnsubscribe();
			} catch (e) {
				console.warn(`[DB Viewer] Error cleaning up old subscription for ${key}:`, e);
			}
		}
		// Store new subscription
		activeStoreSubscriptions.set(key, unsubscribe);
	};
	
	await renderApp(maia, cojsonAPI, authState, syncState, currentView, currentContextCoValueId, currentVibe, switchView, selectCoValue, loadVibe, registerSubscription);
}

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
			// Unloading vibe - destroy all actors for the current vibe container
			// Get container reference from window (set by db-view.js when loading vibe)
			const containerToCleanup = window.currentVibeContainer || currentVibeContainer;
			if (containerToCleanup && maia && maia.actorEngine) {
				maia.actorEngine.destroyActorsForContainer(containerToCleanup);
				currentVibeContainer = null;
				window.currentVibeContainer = null;
			}
			
			currentVibe = null;
			// Restore previous context if available, otherwise keep current context
			if (navigationHistory.length > 0) {
				const previousCoId = navigationHistory.pop();
				currentContextCoValueId = previousCoId;
			} else if (currentContextCoValueId === null) {
				// No history and no context, go to account root
				const accountId = maia?.id?.maiaId?.id;
				if (accountId) {
					currentContextCoValueId = accountId;
				}
			}
		} else {
			// Save current context to history before entering vibe mode
			if (currentContextCoValueId !== null) {
				navigationHistory.push(currentContextCoValueId);
			}
			// Set current vibe state
			currentVibe = vibeKey;
			currentContextCoValueId = null; // Clear DB context
		}
		
		// Re-render to show vibe content or return to DB view
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
window.debugTodos = function() {
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
		
		// Check queries
		if (actor._queries) {
			console.log(`Queries:`, Array.from(actor._queries.keys()));
			for (const [key, query] of actor._queries.entries()) {
				const store = query.store;
				const storeValue = store?.value;
				const storeValueType = Array.isArray(storeValue) ? `array[${storeValue.length}]` : typeof storeValue;
				const subscriberCount = store?._subscribers?.size || 0;
				console.log(`  Query "${key}": store.value = ${storeValueType}, subscribers = ${subscriberCount}`);
			}
		}
		
		// Check initial data received
		if (actor._initialDataReceived) {
			console.log(`Initial data received:`, Array.from(actor._initialDataReceived));
		}
		
		// Check render state
		console.log(`Initial render complete: ${actor._initialRenderComplete}`);
		console.log(`Needs post-init rerender: ${actor._needsPostInitRerender}`);
	}
	
	// Check backend for todos CoList
	const backend = maia.dbEngine?.backend;
	if (backend) {
		try {
			// Try to find todos collection
			const account = backend.getAccount();
			if (account && account.data) {
				const todosListId = account.data.get('todos');
				if (todosListId) {
					console.log(`\n--- Todos CoList ---`);
					console.log(`CoList ID: ${todosListId}`);
					const todosListCore = backend.getCoValue(todosListId);
					if (todosListCore) {
						const isAvailable = backend.isAvailable(todosListCore);
						console.log(`CoList available: ${isAvailable}`);
						if (isAvailable) {
							const content = backend.getCurrentContent(todosListCore);
							if (content && content.toJSON) {
								const itemIds = content.toJSON();
								console.log(`CoList item IDs: ${itemIds.length} items`, itemIds);
								
								// Check each item
								for (const itemId of itemIds) {
									const itemCore = backend.getCoValue(itemId);
									if (itemCore) {
										const itemAvailable = backend.isAvailable(itemCore);
										console.log(`  Item ${itemId.substring(0, 12)}...: available=${itemAvailable}`);
									} else {
										console.log(`  Item ${itemId.substring(0, 12)}...: not in memory`);
									}
								}
							}
						}
					} else {
						console.log(`CoList CoValueCore not found`);
					}
				} else {
					console.log(`\nTodos CoList ID not found in account.data`);
				}
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
window.toggleExpand = toggleExpand;

init();
