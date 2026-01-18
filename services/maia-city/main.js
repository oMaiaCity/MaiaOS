/**
 * MaiaCity Inspector - First Principles
 * 
 * STRICT: Requires passkey authentication via WebAuthn PRF
 */

import { createMaiaOS, signInWithPasskey, signUpWithPasskey, isPRFSupported, subscribeSyncState } from "@MaiaOS/core";
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
		success: '✅',
		error: '⚠️',
		info: 'ℹ️'
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
							Get started by creating a new safe. Your account will be secured with biometric authentication.
						</p>
					` : ''}
					<div class="sign-in-buttons">
						${hasAccount ? `
							<button class="sign-in-btn" onclick="window.handleSignIn()">
								Unlock Safe
							</button>
							<button class="sign-in-btn secondary" onclick="window.handleRegister()">
								Create new Safe
							</button>
						` : `
							<button class="sign-in-btn" onclick="window.handleRegister()">
								Create new Safe
							</button>
							<button class="sign-in-btn secondary" onclick="window.handleSignIn()">
								Already have a safe? Unlock
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
}

function renderAppInternal() {
	renderApp(maia, authState, syncState, currentView, selectedCoValueId, switchView, selectCoValue);
}

// Expose globally for onclick handlers
window.switchView = switchView;
window.selectCoValue = selectCoValue;

init();
