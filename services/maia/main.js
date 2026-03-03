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
	isPRFSupported,
	loadOrCreateAgentAccount,
	MaiaOS,
	resolveAccountToProfileCoId,
	signInWithPasskey,
	signUpWithPasskey,
	subscribeSyncState,
} from '@MaiaOS/loader'
import { renderApp } from './db-view.js'
import { renderLandingPage } from './landing.js'
import {
	getFirstNameForRegister,
	removeSigninKeyHandler,
	renderSignInPrompt,
	renderUnsupportedBrowser,
} from './signin.js'
import { getSyncStatusMessage } from './utils.js'
import { renderVoicePage } from './voice.js'

let maia
let currentScreen = 'dashboard' // Current screen: 'dashboard' | 'maia-db' | 'agent-viewer'
let currentView = 'account' // Current schema filter (default: 'account')
let currentContextCoValueId = null // Currently loaded CoValue in main context (explorer-style navigation)
let currentAgent = null // Currently loaded agent (null = DB view mode, 'todos' = todos agent, etc.)
let currentSpark = null // Grid hierarchy: null = sparks level, '°Maia' = agents for that spark
let _currentAgentContainer = null // Currently loaded agent container element (for cleanup on unload)
let navigationHistory = [] // Navigation history stack for back button
let isRendering = false // Guard to prevent render loops
let authState = {
	signedIn: false,
	accountID: null,
}

// Sync state
let syncState = {
	connected: false,
	syncing: false,
	error: null,
	status: null, // 'authenticating' | 'loading-account' | 'syncing' | 'connected' | 'error'
}

// Subscription management for sync state
let unsubscribeSync = null
let syncStateRenderTimeout = null // Debounce sync state renders

/** Subscribe to sync state changes with debounced renderAppInternal */
function setupSyncSubscription() {
	try {
		unsubscribeSync = subscribeSyncState((state) => {
			const stateChanged = JSON.stringify(syncState) !== JSON.stringify(state)
			syncState = state
			if (stateChanged && !isRendering) {
				if (syncStateRenderTimeout) clearTimeout(syncStateRenderTimeout)
				syncStateRenderTimeout = setTimeout(() => {
					if (!isRendering) renderAppInternal()
				}, 100)
			}
		})
	} catch (_syncError) {}
}

// Check if user has previously authenticated (localStorage flag only, no secrets)
const HAS_ACCOUNT_KEY = 'maia_has_account'

function hasExistingAccount() {
	return localStorage.getItem(HAS_ACCOUNT_KEY) === 'true'
}

function markAccountExists() {
	localStorage.setItem(HAS_ACCOUNT_KEY, 'true')
}

function _clearAccountFlag() {
	localStorage.removeItem(HAS_ACCOUNT_KEY)
}

const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ' }
const TOAST_TITLES = { success: 'Success', error: 'Authentication Failed', info: 'Info' }

/** Show toast notification. type: 'success'|'error'|'info', duration in ms (default 5000) */
function showToast(message, type = 'info', duration = 5000) {
	const toast = document.createElement('div')
	toast.className = `toast ${type}`
	toast.innerHTML = `
		<div class="toast-content">
			<div class="toast-icon">${TOAST_ICONS[type]}</div>
			<div class="toast-message">
				<div class="toast-title">${TOAST_TITLES[type]}</div>
				${message}
			</div>
		</div>
	`
	document.body.appendChild(toast)
	setTimeout(() => {
		toast.classList.add('removing')
		setTimeout(() => document.body.removeChild(toast), 300)
	}, duration)
}

/**
 * Navigation helper function
 */
function navigateTo(path) {
	try {
		window.history.pushState({}, '', path)
		handleRoute().catch((error) => {
			showToast(`Navigation error: ${error.message}`, 'error')
		})
	} catch (error) {
		showToast(`Navigation error: ${error.message}`, 'error')
	}
}

function redirectIfSignedIn() {
	if (authState.signedIn && maia) {
		navigateTo('/me')
		return true
	}
	return false
}

/** Handle route changes */
async function handleRoute() {
	const path = window.location.pathname

	if (path === '/signin' || path === '/signup') {
		if (redirectIfSignedIn()) return
		try {
			await isPRFSupported()
			renderSignInPrompt(hasExistingAccount)
		} catch (error) {
			renderUnsupportedBrowser(error.message)
		}
		return
	}

	if (path === '/voice') {
		removeSigninKeyHandler()
		const ready = detectMode() === 'agent' || (authState.signedIn && maia)
		if (ready) {
			try {
				await renderVoicePage(maia, authState, syncState, navigateToScreen)
			} catch (error) {
				showToast(`Failed to render voice: ${error.message}`, 'error')
			}
			return
		}
		if (authState.signedIn && !maia) {
			renderLoadingConnectingScreen()
			let waitCount = 0
			const checkMaia = setInterval(() => {
				waitCount++
				if (maia) {
					clearInterval(checkMaia)
					cleanupLoadingScreenSync()
					renderVoicePage(maia, authState, syncState, navigateToScreen).catch((e) =>
						showToast(`Failed to render voice: ${e.message}`, 'error'),
					)
				} else if (waitCount > 20) {
					clearInterval(checkMaia)
					cleanupLoadingScreenSync()
					authState = { signedIn: false, accountID: null }
					navigateTo('/signin')
				} else {
					updateLoadingConnectingScreen()
				}
			}, 500)
			return
		}
		navigateTo('/signin')
		return
	}

	if (path === '/me' || path === '/dashboard') {
		removeSigninKeyHandler()
		const ready = detectMode() === 'agent' || (authState.signedIn && maia)
		if (ready) {
			try {
				await renderAppInternal()
			} catch (error) {
				showToast(`Failed to render app: ${error.message}`, 'error')
			}
			return
		}
		if (authState.signedIn && !maia) {
			renderLoadingConnectingScreen()
			let waitCount = 0
			const checkMaia = setInterval(() => {
				waitCount++
				if (maia) {
					clearInterval(checkMaia)
					cleanupLoadingScreenSync()
					renderAppInternal().catch((e) => showToast(`Failed to render app: ${e.message}`, 'error'))
				} else if (waitCount > 20) {
					clearInterval(checkMaia)
					cleanupLoadingScreenSync()
					authState = { signedIn: false, accountID: null }
					navigateTo('/signin')
				} else {
					updateLoadingConnectingScreen()
				}
			}, 500)
			return
		}
		navigateTo('/signin')
		return
	}

	removeSigninKeyHandler()
	if (redirectIfSignedIn()) return
	renderLandingPage()
}

/**
 * Detect operational mode from environment variables
 * Defaults to human mode (client frontend with passkeys)
 * @returns {'human' | 'agent'} Operational mode
 */
function detectMode() {
	const mode =
		(typeof import.meta !== 'undefined' && import.meta.env?.PEER_MODE) ||
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_PEER_MODE) ||
		'human'
	return mode === 'agent' ? 'agent' : 'human'
}

async function init() {
	try {
		// Check if we're in agent mode
		const mode = detectMode()

		if (mode === 'agent') {
			// Agent mode: automatically load/create account and boot MaiaOS
			await initAgentMode()
		} else {
			// Human mode: use existing passkey flow
			// Handle initial route
			await handleRoute()

			// Listen for browser back/forward navigation
			window.addEventListener('popstate', () => {
				handleRoute().catch((_error) => {})
			})
		}
	} catch (error) {
		showToast(`Failed to initialize: ${error.message}`, 'error', 10000)
	}
}

/**
 * Initialize agent mode
 * Automatically loads or creates account using static credentials from env vars
 */
async function initAgentMode() {
	try {
		console.log('🤖 [AGENT MODE] Initializing agent mode...')

		const accountID = import.meta.env?.PEER_ID || import.meta.env?.VITE_PEER_ID
		const agentSecret = import.meta.env?.PEER_SECRET || import.meta.env?.VITE_PEER_SECRET

		if (!accountID || !agentSecret) {
			throw new Error(
				'Agent mode requires PEER_ID and PEER_SECRET. Run `bun agent:generate` to generate credentials.',
			)
		}

		// Determine sync domain
		const syncDomain = getSyncDomain()

		// Load or create agent account using universal DRY interface
		console.log('🤖 [AGENT MODE] Loading agent account...')
		const agentResult = await loadOrCreateAgentAccount({
			accountID,
			agentSecret,
			syncDomain: syncDomain || null,
			createName: 'Maia Agent',
		})

		const { node, account } = agentResult

		// Boot MaiaOS with agent account
		maia = await MaiaOS.boot({
			node,
			account,
			mode: 'agent', // Explicitly set mode
			syncDomain, // Pass sync domain to kernel
			getMoaiBaseUrl, // For POST /register after createSpark
			modules: ['db', 'core', 'ai'], // Include all modules
		})
		window.maia = maia
		// CRITICAL: Await link before first render - indexing requires account.registries
		await linkAccountToRegistries(maia).catch(() => {})

		// Set auth state
		authState = {
			signedIn: true,
			accountID: account.id,
		}

		setupSyncSubscription()

		// Start with dashboard screen
		currentScreen = 'dashboard'
		currentContextCoValueId = null

		// Navigate to /me
		window.history.pushState({}, '', '/me')
		await handleRoute()

		// Load linked CoValues in background
		loadLinkedCoValues().catch((_error) => {})

		console.log('🤖 [AGENT MODE] Agent mode initialized successfully')
	} catch (error) {
		showToast(`Failed to initialize agent mode: ${error.message}`, 'error', 10000)

		// Show error screen
		document.getElementById('app').innerHTML = `
			<div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 1rem;">
				<h1 style="color: #ef4444;">Agent Mode Error</h1>
				<p style="color: #666;">${error.message}</p>
				<p style="color: #999; font-size: 0.875rem;">Check your environment variables and try again.</p>
			</div>
		`
	}
}

/**
 * Determine sync domain from environment (runtime injection or build-time env var)
 * Single source of truth for sync domain configuration
 * In dev: null (sync-peers uses localhost:4201). In prod: VITE_PEER_MOAI
 * @returns {string|null} Sync domain or null if not set
 */
function getSyncDomain() {
	const isDev = import.meta.env?.DEV || window.location.hostname === 'localhost'
	if (isDev) return null // sync-peers defaults to localhost:4201
	return import.meta.env?.VITE_PEER_MOAI || null
}

/** Base URL for moai HTTP API (syncRegistry, etc.) */
function getMoaiBaseUrl() {
	const isDev =
		import.meta.env?.DEV ||
		(typeof window !== 'undefined' &&
			(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
	const apiDomain = getSyncDomain() || import.meta.env?.VITE_PEER_MOAI
	if (!apiDomain && isDev) return 'http://localhost:4201'
	if (!apiDomain) return null
	const host = apiDomain.replace(/^https?:\/\//, '').split('/')[0]
	const protocol =
		host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':4201')
			? 'http'
			: typeof window !== 'undefined' && window.location.protocol === 'https:'
				? 'https'
				: 'http'
	return `${protocol}://${host}`
}

/** Link account to sync server's registries. Set account.registries only. Sparks resolved via registries.sparks. Human and agent. */
async function linkAccountToRegistries(maia) {
	if (!maia?.id?.node || !maia.id.maiaId) return
	const baseUrl = getMoaiBaseUrl()
	if (!baseUrl) return
	try {
		const res = await fetch(`${baseUrl}/syncRegistry`)
		if (!res.ok) return
		const data = await res.json()
		const registriesId = data?.registries
		const { maiaId: account } = maia.id
		if (registriesId?.startsWith('co_z')) {
			account.set('registries', registriesId)
		}
	} catch (_e) {}
}

/** Auto-register human in registry (fire-and-forget). Call after linkAccountToRegistries. Uses server-generated name only (e.g. human:brave-dolphin-71234567). */
async function autoRegisterHuman(maia) {
	if (!maia?.id?.maiaId || detectMode() === 'agent') return
	const baseUrl = getMoaiBaseUrl()
	if (!baseUrl) return
	const account = maia.id.maiaId
	const accountId = account.id || account.$jazz?.id
	if (!accountId?.startsWith('co_z')) return
	const profileId = account.get?.('profile')
	if (!profileId?.startsWith('co_z')) return
	try {
		await fetch(`${baseUrl}/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'human', accountId, profileId }),
		})
	} catch (_e) {}
}

/**
 * Sign in with existing passkey
 */
async function signIn() {
	try {
		// Determine sync domain (single source of truth - passed through kernel)
		const syncDomain = getSyncDomain()
		if (!syncDomain) {
		}

		const signInResult = await signInWithPasskey({
			salt: 'maia.city',
		})
		const { accountID, agentSecret: _agentSecret, loadingPromise } = signInResult

		// Set auth state IMMEDIATELY after auth (before account loads)
		// This allows UI to show right away
		authState = {
			signedIn: true,
			accountID: accountID,
		}

		// Mark that user has successfully authenticated
		markAccountExists()

		// Await account loading in background and boot MaiaOS when ready
		loadingPromise
			.then(async (accountResult) => {
				const { node, account } = accountResult
				console.log(`   node: ${node ? 'ready' : 'not ready'}`)
				console.log(`   account: ${account ? 'ready' : 'not ready'}`)

				try {
					maia = await MaiaOS.boot({
						node,
						account,
						syncDomain, // Pass sync domain to kernel (single source of truth)
						getMoaiBaseUrl, // For POST /register after createSpark
						modules: ['db', 'core', 'ai'], // Include all modules
					})
					window.maia = maia
					// CRITICAL: Await link before first render - indexing requires account.registries
					await linkAccountToRegistries(maia).catch(() => {})
					autoRegisterHuman(maia).catch(() => {})

					// Re-render app now that maia is ready
					if (authState.signedIn) {
						renderAppInternal().catch((error) => {
							showToast(`Failed to render app: ${error.message}`, 'error')
						})
					}
				} catch (bootError) {
					showToast(`Failed to initialize MaiaOS: ${bootError.message}`, 'error')
					// Don't throw - UI is already shown, user can retry
				}
			})
			.catch((loadError) => {
				showToast(`Failed to load account: ${loadError.message}`, 'error')
				// Reset auth state on error
				authState = { signedIn: false, accountID: null }
				maia = null
			})

		setupSyncSubscription()

		// Start with dashboard screen (don't set default context)
		currentScreen = 'dashboard'
		currentContextCoValueId = null

		// Navigate to /me IMMEDIATELY - don't wait for data loading
		// This ensures UI shows right away, especially important on mobile

		// Update URL first
		window.history.pushState({}, '', '/me')

		// Then handle route (which will render the app)
		handleRoute().catch((error) => {
			showToast(`Navigation error: ${error.message}`, 'error')
		})

		// Load linked CoValues in background (non-blocking)
		// This allows the UI to show immediately while data loads progressively
		loadLinkedCoValues().catch((_error) => {
			// Non-fatal - UI is already shown, data will load progressively via sync
		})
	} catch (error) {
		// Reset state on error to prevent stuck state
		authState = { signedIn: false, accountID: null }
		maia = null

		if (error.message.includes('PRF not supported') || error.message.includes('WebAuthn')) {
			renderUnsupportedBrowser(error.message)
		} else if (
			error.name === 'NotAllowedError' ||
			error.message.includes('User denied permission') ||
			error.message.includes('denied permission')
		) {
			showToast(
				"You cancelled the passkey prompt. Click the button again when you're ready.",
				'info',
				5000,
			)
			renderSignInPrompt(hasExistingAccount)
		} else {
			const friendlyMessage = error.message.includes('Failed to evaluate PRF')
				? 'Unable to authenticate with your passkey. Please try again.'
				: error.message
			showToast(friendlyMessage, 'error', 7000)
			renderSignInPrompt(hasExistingAccount)
		}
	}
}

/** Load linked CoValues from account (registries via deep resolution) */
async function loadLinkedCoValues() {
	if (!maia?.id?.maiaId) return
	try {
		const accountStore = await maia.do({ op: 'read', schema: '@account', key: maia.id.maiaId.id })
		const accountData = accountStore?.value ?? accountStore
		const registriesId = accountData?.registries
		if (typeof registriesId === 'string' && registriesId.startsWith('co_')) {
			await maia.do({ op: 'read', schema: registriesId, key: registriesId, deepResolve: true })
		}
	} catch (_e) {}
}

/**
 * Register new passkey
 */
async function register() {
	try {
		// Require first name before passkey prompt - input must exist and be filled
		const firstNameInput = document.getElementById('signin-first-name')
		if (firstNameInput) {
			const val = (firstNameInput.value || '').trim()
			if (!val) {
				firstNameInput.focus()
				firstNameInput.setAttribute('aria-invalid', 'true')
				showToast('Please enter your first name before creating your Self.', 'info', 4000)
				return
			}
			firstNameInput.removeAttribute('aria-invalid')
		}

		// Determine sync domain (single source of truth - passed through kernel)
		const syncDomain = getSyncDomain()
		const isDev = import.meta.env?.DEV || window.location.hostname === 'localhost'
		if (!syncDomain && !isDev) {
		}

		// First name from input (trimmed, max 50 chars); empty → fallback to "Traveler " + short id
		const firstName = getFirstNameForRegister()
		const name = firstName && firstName.length <= 50 ? firstName.trim() : undefined

		const { accountID, node, account } = await signUpWithPasskey({
			name,
			salt: 'maia.city',
		})

		// Boot MaiaOS with node, account, and sync domain (using CoJSON backend)
		// Sync domain stored in kernel as single source of truth
		// This must succeed before we mark as signed in
		try {
			maia = await MaiaOS.boot({
				node,
				account,
				syncDomain, // Pass sync domain to kernel (single source of truth)
				getMoaiBaseUrl, // For POST /register after createSpark
				modules: ['db', 'core', 'ai'], // Include all modules
			})
			window.maia = maia
			// CRITICAL: Await link before first render - indexing requires account.registries
			await linkAccountToRegistries(maia).catch(() => {})
			autoRegisterHuman(maia).catch(() => {})
		} catch (bootError) {
			throw new Error(`Failed to initialize MaiaOS: ${bootError.message}`)
		}

		// Set auth state AFTER maia is successfully booted
		authState = {
			signedIn: true,
			accountID: accountID,
		}

		// Mark that user has successfully registered
		markAccountExists()

		setupSyncSubscription()

		// Start with dashboard screen (don't set default context)
		currentScreen = 'dashboard'
		currentContextCoValueId = null

		// Navigate to /me IMMEDIATELY - don't wait for data loading
		// This ensures UI shows right away, especially important on mobile

		// Update URL first
		window.history.pushState({}, '', '/me')

		// Then handle route (which will render the app)
		handleRoute().catch((error) => {
			showToast(`Navigation error: ${error.message}`, 'error')
		})

		// Load linked CoValues in background (non-blocking)
		// This allows the UI to show immediately while data loads progressively
		loadLinkedCoValues().catch((_error) => {
			// Non-fatal - UI is already shown, data will load progressively via sync
		})
	} catch (error) {
		if (error.message.includes('PRF not supported') || error.message.includes('WebAuthn')) {
			renderUnsupportedBrowser(error.message)
		} else if (
			error.name === 'NotAllowedError' ||
			error.message.includes('User denied permission') ||
			error.message.includes('denied permission')
		) {
			showToast(
				"You cancelled the passkey prompt. Click the button again when you're ready.",
				'info',
				5000,
			)
			renderSignInPrompt(hasExistingAccount)
		} else {
			const friendlyMessage = error.message.includes('Failed to create passkey')
				? 'Unable to create passkey. Please try again.'
				: error.message
			showToast(friendlyMessage, 'error', 7000)
			renderSignInPrompt(hasExistingAccount)
		}
	}
}

function signOut() {
	// Signing out
	if (unsubscribeSync) {
		unsubscribeSync()
		unsubscribeSync = null
	}
	authState = { signedIn: false, accountID: null }
	syncState = { connected: false, syncing: false, error: null, status: null }
	maia = null

	// DON'T clear the account flag - passkey still exists on device!
	// User can still sign back in, so UI should show "Sign In" as primary
	window.location.reload()
}

// Store loading screen sync subscription
let loadingScreenSyncUnsubscribe = null

const LOADING_SCREEN_HTML = (syncMessage, indicatorStyle) => `
	<div class="app-container" style="opacity: 0.5; pointer-events: none;">
		<div class="dashboard-container">
			<div class="dashboard-header"><h1>Maia City</h1></div>
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
	<div class="loading-connecting-overlay">
		<div class="loading-spinner"></div>
		<div class="loading-connecting-content">
			<h2>Initializing your account</h2>
			<div class="loading-connecting-subtitle">Setting up your sovereign self...</div>
			<div class="sync-status loading-connecting-sync">
				<div class="sync-indicator loading-connecting-indicator" style="${indicatorStyle}"></div>
				<span class="sync-message">${syncMessage}</span>
			</div>
		</div>
	</div>`

/** Render loading/connecting screen; sets up sync state listener for live updates */
function renderLoadingConnectingScreen() {
	const syncMsg = getSyncStatusMessage(syncState, 'Connecting to sync...')
	const isConnected = syncState.connected && syncState.status === 'connected'
	const hasError = syncState.status === 'error' || syncState.error
	const indicatorStyle = `background: ${isConnected ? 'var(--color-lush-green)' : hasError ? 'var(--brand-red)' : 'var(--color-sun-yellow)'}; animation: ${isConnected ? 'none' : 'pulse 2s ease-in-out infinite'};`
	document.getElementById('app').innerHTML = LOADING_SCREEN_HTML(syncMsg, indicatorStyle)
	if (!loadingScreenSyncUnsubscribe) {
		loadingScreenSyncUnsubscribe = subscribeSyncState((state) => {
			syncState = state
			updateLoadingConnectingScreen()
		})
	}
}

/**
 * Update loading/connecting screen with current sync status
 */
function updateLoadingConnectingScreen() {
	const syncStatusElement = document.querySelector('.sync-status')
	const syncIndicator = document.querySelector('.sync-indicator')
	const syncMessageElement = document.querySelector('.sync-message')
	const syncMessage = getSyncStatusMessage(syncState, 'Connecting to sync...')

	if (syncStatusElement && syncIndicator && syncMessageElement) {
		syncMessageElement.textContent = syncMessage
		const isConnected = syncState.connected && syncState.status === 'connected'
		const hasError = syncState.status === 'error' || syncState.error
		syncIndicator.style.background = isConnected
			? 'var(--color-lush-green)'
			: hasError
				? 'var(--brand-red)'
				: 'var(--color-sun-yellow)'
		syncIndicator.style.animation = isConnected ? 'none' : 'pulse 2s ease-in-out infinite'
	}
}

/**
 * Clean up loading screen sync subscription
 */
function cleanupLoadingScreenSync() {
	if (loadingScreenSyncUnsubscribe) {
		loadingScreenSyncUnsubscribe()
		loadingScreenSyncUnsubscribe = null
	}
}

// Expose globally for onclick handlers
window.handleSignIn = signIn
window.handleRegister = register

// Swap signin/signup view mode (link-style toggle)
window.switchToSigninView = () => renderSignInPrompt(hasExistingAccount, 'signin')
window.switchToSignupView = () => renderSignInPrompt(hasExistingAccount, 'signup')
window.navigateTo = navigateTo
window.handleSignOut = signOut
window.showToast = showToast // Expose for debugging

// Navigation function for screen transitions
// @param {string} screen - Screen to navigate to
// @param {Object} [options] - Options
// @param {boolean} [options.preserveSpark] - If true, keep currentSpark (Home from agent → agents grid, not sparks root)
function navigateToScreen(screen, options = {}) {
	currentScreen = screen
	if (screen === 'dashboard') {
		currentAgent = null
		currentContextCoValueId = null
		if (!options.preserveSpark) {
			currentSpark = null
		}
		navigationHistory = []
	}
	renderAppInternal()
}

/**
 * Load a spark context (grid hierarchy level 1 → level 2)
 * @param {string|null} spark - Spark name (e.g. '°Maia') or null to go back to sparks level
 */
function loadSpark(spark) {
	currentSpark = spark
	// Stay on dashboard, just re-render with new level
	currentScreen = 'dashboard'
	renderAppInternal()
}

// switchView moved above selectCoValue

function selectCoValueInternal(coId, skipHistory = false) {
	// Collapse sidebars when selecting a co-value
	collapseAllSidebars()

	// If we're in agent mode and selecting account, exit agent mode first
	if (currentAgent !== null && coId === maia?.id?.maiaId?.id) {
		currentAgent = null
		// If there's navigation history, restore the previous context instead of going to account
		if (navigationHistory.length > 0) {
			const previousCoId = navigationHistory.pop()
			currentContextCoValueId = previousCoId
			renderAppInternal()
			return
		}
	}

	// Add current context to navigation history (unless we're going back or it's null)
	if (!skipHistory && currentContextCoValueId !== null && currentContextCoValueId !== coId) {
		navigationHistory.push(currentContextCoValueId)
	}

	// Explorer-style navigation: load CoValue into main container context
	currentContextCoValueId = coId
	currentScreen = 'maia-db' // Navigate to DB viewer when selecting a CoValue
	renderAppInternal()
	// read() API in db-view.js handles loading and reactivity automatically
}

/** Resolve account co-id to profile when possible (for clicks); then select. */
async function selectCoValue(coId, skipHistory = false) {
	let targetCoId = coId
	if (coId?.startsWith('co_z') && maia?.db) {
		try {
			const profileId = await resolveAccountToProfileCoId(maia, coId)
			if (profileId) targetCoId = profileId
		} catch (_e) {}
	}
	selectCoValueInternal(targetCoId, skipHistory)
}

/**
 * Collapse all sidebars (both DB viewer and agent viewer)
 */
function collapseAllSidebars() {
	// Collapse DB viewer sidebars
	const dbSidebar = document.querySelector('.db-sidebar')
	const dbMetadata = document.querySelector('.db-metadata')
	if (dbSidebar) {
		dbSidebar.classList.add('collapsed')
	}
	if (dbMetadata) {
		dbMetadata.classList.add('collapsed')
	}

	// Collapse agent viewer sidebars (in Shadow DOM)
	const agentContainer = document.querySelector('.agent-container')
	if (agentContainer?.shadowRoot) {
		const navAside = agentContainer.shadowRoot.querySelector('.nav-aside')
		const detailAside = agentContainer.shadowRoot.querySelector('.detail-aside')
		if (navAside) {
			navAside.classList.add('collapsed')
		}
		if (detailAside) {
			detailAside.classList.add('collapsed')
		}
	}
}

function goBack() {
	// If we're in agent mode, exit agent mode first
	if (currentAgent !== null) {
		loadAgent(null)
		return
	}

	// If we're in maia-db, navigate back in history or go to dashboard
	if (currentScreen === 'maia-db') {
		if (navigationHistory.length > 0) {
			const previousCoId = navigationHistory.pop()
			selectCoValue(previousCoId, true) // Skip adding to history
		} else {
			// No history, go to dashboard
			navigateToScreen('dashboard')
		}
	} else {
		// Default: go to dashboard
		navigateToScreen('dashboard')
	}
}

function switchView(view) {
	currentView = view
	currentContextCoValueId = null // Reset context when switching views
	navigationHistory = [] // Clear navigation history when switching views
	currentScreen = 'maia-db' // Ensure we're in DB viewer when switching views
	renderAppInternal()
}

async function renderAppInternal() {
	// Guard against render loops
	if (isRendering) {
		return
	}

	isRendering = true

	try {
		await renderApp(
			maia,
			authState,
			syncState,
			currentScreen,
			currentView,
			currentContextCoValueId,
			currentAgent,
			currentSpark,
			switchView,
			selectCoValue,
			loadAgent,
			loadSpark,
			navigateToScreen,
		)
	} finally {
		isRendering = false
	}
}

// Expose renderAppInternal globally for reactive updates
window.renderAppInternal = renderAppInternal

/**
 * Load an agent inline in the main context area
 * @param {string|null} agentKey - Agent key (e.g., 'todos') or null to exit agent mode
 */
async function loadAgent(agentKey) {
	if (!maia && agentKey !== null) {
		return
	}

	if (agentKey !== null && typeof agentKey !== 'string') {
		return
	}

	try {
		if (typeof window !== 'undefined' && window._maiaDebugFreeze) {
		}
		if (agentKey === null) {
			if (currentAgent && maia?.runtime) {
				maia.runtime.destroyActorsForAgent(currentAgent)
			}

			_currentAgentContainer = null
			window.currentAgentContainer = null

			currentAgent = null
			navigateToScreen('dashboard', { preserveSpark: true })
		} else {
			if (currentAgent && currentAgent !== agentKey && maia?.runtime) {
				maia.runtime.destroyActorsForAgent(currentAgent)
			}

			if (currentContextCoValueId !== null) {
				navigationHistory.push(currentContextCoValueId)
			}
			currentAgent = agentKey
			currentContextCoValueId = null
			currentScreen = 'agent-viewer'
		}

		await renderAppInternal()
		if (typeof window !== 'undefined' && window._maiaDebugFreeze) {
		}
	} catch (_error) {
		currentAgent = null
		await renderAppInternal()
	}
}

function toggleExpand(expandId) {
	const element = document.getElementById(expandId)

	if (element) {
		const isExpanded = element.style.display !== 'none'
		element.style.display = isExpanded ? 'none' : 'block'

		// Rotate the expand icon - need to find it in the button
		const wrapper = element.parentElement
		const button = wrapper?.querySelector('button')
		const icon = button?.querySelector('.expand-icon')

		if (icon) {
			icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)'
		}
	}
}

// Expose globally for onclick handlers
window.switchView = switchView
window.selectCoValue = selectCoValue
window.goBack = goBack
window.loadAgent = loadAgent
window.loadSpark = loadSpark
window.navigateToScreen = navigateToScreen
window.toggleExpand = toggleExpand

// Account menu toggle (username opens dropdown with account ID + sign out)
window.toggleMobileMenu = () => {
	const menu = document.getElementById('mobile-menu')
	if (!menu) return
	menu.classList.toggle('active')
	const trigger = document.querySelector('.account-menu-toggle')
	if (trigger) trigger.classList.toggle('active', menu.classList.contains('active'))
}

/** Toggle sidebar (DB viewer or agent viewer). Pass containerSelector for Shadow DOM. */
function toggleSidebar(sidebarSelector, otherSidebarSelector, containerSelector) {
	const root = containerSelector ? document.querySelector(containerSelector)?.shadowRoot : document
	if (!root) return
	const sidebar = root.querySelector(sidebarSelector)
	if (!sidebar) return
	sidebar.classList.add('sidebar-ready')
	sidebar.classList.toggle('collapsed')
	const other = root.querySelector(otherSidebarSelector)
	if (other && !sidebar.classList.contains('collapsed')) {
		other.classList.add('sidebar-ready')
		other.classList.add('collapsed')
	}
}

window.toggleDBLeftSidebar = () => toggleSidebar('.db-sidebar', '.db-metadata')
window.toggleDBRightSidebar = () => toggleSidebar('.db-metadata', '.db-sidebar')
window.toggleLeftSidebar = () => toggleSidebar('.nav-aside', '.detail-aside', '.agent-container')
window.toggleRightSidebar = () => toggleSidebar('.detail-aside', '.nav-aside', '.agent-container')

init()
