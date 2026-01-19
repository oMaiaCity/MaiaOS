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

import { createMaiaOS, signInWithPasskey, signUpWithPasskey, isPRFSupported, subscribeSyncState } from "@MaiaOS/core";
import { seedExampleCoValues as seedCoValues } from "@MaiaOS/db";
import { renderApp } from './db-view.js';

let maia;
let currentView = 'account'; // Current schema type being viewed
let selectedCoValueId = null; // Selected CoValue for detail view
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
		console.log("🚀 Initializing MaiaCity...");
		
		// STRICT: Check PRF support first
		try {
			await isPRFSupported();
			console.log("✅ WebAuthn PRF supported");
		} catch (error) {
			console.error("❌ PRF not supported:", error);
			renderUnsupportedBrowser(error.message);
			return;
		}
		
		// Show sign-in prompt (no localStorage check)
		console.log("🔐 Showing sign-in prompt");
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
		console.log("🔐 Signing in with existing passkey...");
		
		const { accountID, node, account } = await signInWithPasskey({ salt: "maia.city" });
		
		console.log("✅ Existing passkey authenticated:", accountID);
		
		// Create MaiaOS with node and account
		maia = await createMaiaOS({ node, account, accountID });
		window.maia = maia;
		
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
		// Jazz uses lazy-loading - CoValues are only loaded when explicitly requested
		await loadLinkedCoValues();
		
		renderAppInternal();
		
		console.log("✅ MaiaOS initialized with authenticated account!");
		
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
	
	console.log("🔄 Loading linked CoValues from account...");
	
	// Get the examples ID
	const examplesId = account.get("examples");
	if (!examplesId) {
		console.log("   No examples linked to account");
		return;
	}
	
	console.log(`   Examples ID: ${examplesId}`);
	
	// Explicitly load the examples CoMap from IndexedDB
	try {
		const examplesCore = await node.loadCoValueCore(examplesId);
		if (examplesCore.isAvailable()) {
			console.log("   ✅ Examples CoMap loaded from IndexedDB");
			
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
			
			console.log(`   Found ${childIds.length} child CoValues to load`);
			
			// Load each child CoValue
			for (const { key, id } of childIds) {
				const childCore = await node.loadCoValueCore(id);
				if (childCore.isAvailable()) {
					console.log(`   ✅ ${key} (${id.substring(0, 12)}...) loaded from IndexedDB`);
				} else {
					console.log(`   ⏳ ${key} (${id.substring(0, 12)}...) not yet available`);
				}
			}
			
			console.log("✅ All linked CoValues loaded!");
		} else {
			console.log("   ⏳ Examples CoMap not yet available");
		}
	} catch (error) {
		console.error("   ❌ Failed to load examples:", error);
	}
}

/**
 * Seed example CoValues for demonstration
 * 
 * Uses the centralized seeding service from @MaiaOS/db
 * Creates: CoPlainText, CoStream, Notes, and Examples CoMap
 * Links examples to account.examples for Jazz lazy-loading
 */
async function seedExampleCoValues() {
	try {
		console.log("🌱 Seeding example CoValues...");
		
		const { node, maiaId: account } = maia.id;
		
		// Use the centralized seeding service
		await seedCoValues(node, account, { name: "Maia User" });
		
		console.log("🌱 Seeding complete!");
		
		// Refresh the UI to show new CoValues
		renderAppInternal();
		
	} catch (error) {
		console.error("❌ Seeding failed:", error);
		console.error("Stack:", error.stack);
		showToast(`Failed to create example data: ${error.message}`, 'error', 7000);
	}
}

/**
 * Register new passkey
 */
async function register() {
	try {
		console.log("📝 Registering new passkey...");
		
		const { accountID, node, account } = await signUpWithPasskey({ 
			name: "maia",
			salt: "maia.city" 
		});
		
		console.log("✅ New passkey created:", accountID);
		
		// Create MaiaOS with node and account
		maia = await createMaiaOS({ node, account, accountID });
		window.maia = maia;
		
		authState = {
			signedIn: true,
			accountID: accountID,
		};
		
		// Mark that user has successfully registered
		markAccountExists();
		console.log("✅ Marked account as existing in localStorage");
		console.log("   localStorage now:", localStorage.getItem('maia_has_account'));
		
		// Subscribe to sync state changes
		unsubscribeSync = subscribeSyncState((state) => {
			syncState = state;
			renderAppInternal(); // Re-render when sync state changes
		});
		
		// Seed example CoValues for new accounts
		// This creates UserGroup + Profile + examples (5 CoValues total)
		await seedExampleCoValues();
		
		renderAppInternal();
		
		console.log("✅ MaiaOS initialized with new account!");
		
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
	console.log("🚪 Signing out...");
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

function renderSignInPrompt() {
	const hasAccount = hasExistingAccount();
	
	console.log("🔍 Rendering sign-in prompt...");
	console.log("   localStorage flag:", localStorage.getItem('maia_has_account'));
	console.log("   hasAccount:", hasAccount);
	
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

// Expose globally for onclick handlers
window.handleSignIn = signIn;
window.handleRegister = register;
window.handleSignOut = signOut;
window.showToast = showToast; // Expose for debugging

function switchView(view) {
	currentView = view;
	selectedCoValueId = null; // Reset selection when switching views
	renderAppInternal();
}

function selectCoValue(coId) {
	selectedCoValueId = coId;
	renderAppInternal();
	
	// If selecting a CoValue, subscribe to its loading state
	if (coId && maia?.id?.node) {
		const coValueCore = maia.id.node.getCoValue(coId);
		if (coValueCore && !coValueCore.isAvailable()) {
			console.log(`⏳ CoValue ${coId.substring(0, 12)}... not available yet, subscribing to updates...`);
			
			// Subscribe to updates and re-render when available
			const unsubscribe = coValueCore.subscribe((core) => {
				if (core.isAvailable()) {
					console.log(`✅ CoValue ${coId.substring(0, 12)}... now available! Re-rendering...`);
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

function renderAppInternal() {
	renderApp(maia, authState, syncState, currentView, selectedCoValueId, switchView, selectCoValue);
}

// Expose globally for onclick handlers
window.switchView = switchView;
window.selectCoValue = selectCoValue;

init();
