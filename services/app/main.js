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
	applyMaiaLoggingFromEnv,
	createLogger,
	createPerfTracer,
	installDefaultTransport,
	resolveMaiaLoggingEnv,
} from '@MaiaOS/logs'
import { getSyncHttpBaseUrl } from '@MaiaOS/peer'
import {
	BOOTSTRAP_PHASES,
	bootstrapAccountHandshake,
	CAP_GRANT_TTL_SECONDS,
	ensureIdentity,
	getCapabilityGrantIndexColistCoId,
	isPRFSupported,
	loadCapabilitiesGrants,
	loadOrCreateAgentAccount,
	MaiaOS,
	resetBootstrapPhase,
	resolveAccountCoIdsToProfiles,
	signInWithPasskey,
	signUpWithPasskey,
	subscribeBootstrapPhase,
	subscribeSyncState,
	updateSyncState,
	validateInvite,
} from '@MaiaOS/runtime'
import { accountLoadingSpinnerHtml } from './account-loading-spinner-html.js'
import { renderApp, toggleMetadataInternalKey } from './db-view.js'
import { beginIntroDiary, renderIntroPage } from './intro.js'
import { renderLandingPage } from './landing.js'
import { disposeGlobalAI, initGlobalAI, setFabVisible, updateNavLeft } from './maia-ai-global.js'
import {
	getFirstNameForRegister,
	removeSigninKeyHandler,
	renderSignInPrompt,
	setSignInLoading,
} from './signin.js'
import { escapeHtml, getSyncStatusMessage } from './utils.js'

const appLog = createLogger('app')

/** Message string from catch — handles non-Error throws (string, Tauri, undefined). */
function caughtErrMessage(error) {
	if (error == null) return ''
	if (typeof error === 'string') return error
	if (typeof error === 'object' && typeof error.message === 'string') return error.message
	try {
		return String(error)
	} catch {
		return ''
	}
}

function caughtErrName(error) {
	if (error != null && typeof error === 'object' && typeof error.name === 'string') {
		return error.name
	}
	return ''
}

/** Wait until after the next composited frame (double rAF) so PERF includes visible paint. */
function waitUntilNextPaint() {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve())
		})
	})
}

let maia
/** spark.os.indexes[OS_CAPABILITY] schema index CoList co-id — navigation + DB viewer capabilities shell */
let capabilityGrantsIndexColistCoId = null
let currentScreen = 'dashboard' // Current screen: 'dashboard' | 'maia-db' | 'the-game' | 'vibe-viewer' | …
let currentView = 'account' // Current schema filter (default: 'account')
let currentContextCoValueId = null // Currently loaded CoValue in main context (explorer-style navigation)
/** Maia DB SYNC SERVER: selected storage table name, or null when using Explorer */
let syncServerSelectedTable = null
/** Row offset for SYNC SERVER table paging (500 rows per page). */
let syncServerTableOffset = 0

const SYNC_SERVER_PAGE_SIZE = 500

function syncServerPagePrev() {
	if (!syncServerSelectedTable) return
	syncServerTableOffset = Math.max(0, syncServerTableOffset - SYNC_SERVER_PAGE_SIZE)
	renderAppInternal()
}

function syncServerPageNext() {
	if (!syncServerSelectedTable) return
	syncServerTableOffset += SYNC_SERVER_PAGE_SIZE
	renderAppInternal()
}
let currentVibe = null // Currently loaded vibe (null = DB view mode, 'todos' = todos vibe, etc.)
let currentSpark = null // Grid hierarchy: null = sparks level, '°maia' = avens for that spark
let navigationHistory = [] // Navigation history stack for back button
let isRendering = false // Guard to prevent render loops
let pendingRender = false // Re-run render when navigateToScreen called while renderApp is still awaiting
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

let _maiaReadyResolve
if (typeof window !== 'undefined') {
	window.__maiaReady = new Promise((resolve) => {
		_maiaReadyResolve = resolve
	})
}
function notifyMaiaReady(bootedMaia) {
	if (typeof _maiaReadyResolve === 'function') {
		const fn = _maiaReadyResolve
		_maiaReadyResolve = null
		fn(bootedMaia)
	}
}

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

/** Both sign-in and sign-up stay available — no separate localStorage flag (OPFS is source of truth). */
function hasExistingAccount() {
	return true
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
		setFabVisible(false)
		if (redirectIfSignedIn()) return
		let prfOk = false
		try {
			await isPRFSupported()
			prfOk = true
		} catch (_) {
			/* passkeys unavailable — secret-key dev sign-in can still work */
		}
		renderSignInPrompt(
			hasExistingAccount,
			undefined,
			isSecretKeyDevSignInEnabled(),
			getSignInUiHandlers(),
			!prfOk,
		)
		return
	}

	if (path === '/intro') {
		removeSigninKeyHandler()
		setFabVisible(false)
		if (redirectIfSignedIn()) return
		renderIntroPage()
		return
	}

	if (path === '/game') {
		if (!isGameDevRouteEnabled()) {
			window.history.replaceState({}, '', authState.signedIn && maia ? '/me' : '/')
			await handleRoute()
			return
		}
		removeSigninKeyHandler()
		setFabVisible(false)
		currentScreen = 'the-game'
		try {
			await renderAppInternal()
		} catch (error) {
			showToast(`Failed to load game: ${error.message}`, 'error')
		}
		return
	}

	if (path === '/me' || path === '/dashboard') {
		removeSigninKeyHandler()
		const ready = detectMode() === 'agent' || (authState.signedIn && maia)
		setFabVisible(ready)
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
			// First load on a new browser can pull a large account from sync; allow up to ~60s before giving up.
			const maxTicks = 120
			const checkMaia = setInterval(() => {
				waitCount++
				if (maia) {
					clearInterval(checkMaia)
					cleanupLoadingScreenSync()
					renderAppInternal().catch((e) => showToast(`Failed to render app: ${e.message}`, 'error'))
				} else if (waitCount > maxTicks) {
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
	setFabVisible(false)
	if (redirectIfSignedIn()) return
	renderLandingPage()
}

/**
 * Detect operational mode from environment variables
 * Defaults to human mode (client frontend with passkeys)
 * @returns {'human' | 'agent'} Operational mode
 */
function detectMode() {
	const mode = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PEER_MODE) || 'human'
	return mode === 'agent' ? 'agent' : 'human'
}

/** `/game` route: dev-only (never enabled in production bundle; localhost + __maia_env DEV for Bun dev without import.meta.DEV). */
function isGameDevRouteEnabled() {
	if (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) {
		return true
	}
	const h = typeof window !== 'undefined' ? window.location.hostname : ''
	if (h !== 'localhost' && h !== '127.0.0.1') {
		return false
	}
	return window.__MAIA_DEV_ENV__?.DEV === true
}

async function init() {
	setupMaiaAppDelegation()
	document.addEventListener('maia-schedule-render', () => {
		void renderAppInternal()
	})
	try {
		// Dev: fetch env from server (Bun dev doesn't inject VITE_* like Vite). Skip in Tauri (tauri:// — env is build-time).
		if (
			typeof window !== 'undefined' &&
			window.location.protocol !== 'tauri:' &&
			(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
		) {
			try {
				const res = await fetch('/__maia_env')
				if (res.ok) {
					window.__MAIA_DEV_ENV__ = await res.json()
				} else {
					window.__MAIA_DEV_ENV__ = {
						DEV: true,
						LOG_MODE: '',
						LOG_LEVEL: '',
						LOG_MODE_PROD: '',
						NODE_ENV: 'development',
					}
				}
			} catch (_e) {
				window.__MAIA_DEV_ENV__ = {
					DEV: true,
					LOG_MODE: '',
					LOG_LEVEL: '',
					LOG_MODE_PROD: '',
					NODE_ENV: 'development',
				}
			}
			// URL override: /me?log_mode=perf.all (useful when shell env did not reach dev-server)
			const params = new URLSearchParams(window.location.search)
			const urlLogMode = params.get('log_mode') ?? params.get('LOG_MODE')
			if (urlLogMode) {
				window.__MAIA_DEV_ENV__.LOG_MODE = urlLogMode
			}
		}
		applyMaiaLoggingFromEnv(resolveMaiaLoggingEnv())
		installDefaultTransport()

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
 * Initialize agent mode — same unified bootstrap path as human mode.
 * (loadOrCreateAgentAccount -> bootstrapAccountHandshake -> MaiaOS.boot)
 */
async function initAgentMode() {
	try {
		appLog.log('[AGENT MODE] Initializing agent mode...')

		const accountID = import.meta.env?.AVEN_MAIA_ACCOUNT || import.meta.env?.VITE_AVEN_MAIA_ACCOUNT
		const agentSecret = import.meta.env?.AVEN_MAIA_SECRET || import.meta.env?.VITE_AVEN_MAIA_SECRET

		if (!accountID || !agentSecret) {
			throw new Error(
				'Agent mode requires AVEN_MAIA_ACCOUNT and AVEN_MAIA_SECRET. Run `bun agent:generate` to generate credentials.',
			)
		}

		const syncDomain = getSyncDomain()

		startBootstrapPhaseOverlay()

		appLog.log('[AGENT MODE] Loading agent account...')
		const { node, account } = await loadOrCreateAgentAccount({
			accountID,
			agentSecret,
			syncDomain: syncDomain || null,
			createName: 'Maia Agent',
		})

		const baseUrl = getSyncBaseUrl()
		if (baseUrl) {
			await bootstrapAccountHandshake(account, { syncBaseUrl: baseUrl, node })
		} else {
			appLog.warn?.('[AGENT MODE] no sync base URL — skipping bootstrap handshake (offline mode)')
		}

		maia = await MaiaOS.boot({
			node,
			account,
			syncDomain,
			getSyncBaseUrl,
			modules: ['db', 'core', 'ai'],
		})
		stopBootstrapPhaseOverlay()
		window.maia = maia
		void refreshMemberSyncState(maia)
		capabilityGrantsIndexColistCoId = (await getCapabilityGrantIndexColistCoId(maia)) ?? null
		initGlobalAI(maia)
		notifyMaiaReady(maia)

		authState = { signedIn: true, accountID: account.id }

		setupSyncSubscription()

		currentScreen = 'dashboard'
		currentContextCoValueId = null

		window.history.pushState({}, '', '/me')
		await handleRoute()

		loadLinkedCoValues().catch((_error) => {})

		appLog.log('[AGENT MODE] Agent mode initialized successfully')
	} catch (error) {
		stopBootstrapPhaseOverlay()
		showToast(`Failed to initialize agent mode: ${error.message}`, 'error', 10000)

		document.getElementById('app').innerHTML = `
			<div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 1rem;">
				<h1 style="color: #ef4444;">Agent Mode Error</h1>
				<p style="color: #666;">${escapeHtml(error.message)}</p>
				<p style="color: #999; font-size: 0.875rem;">Check your environment variables and try again.</p>
			</div>
		`
	}
}

const isLocalAppHost =
	typeof window !== 'undefined' &&
	(window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1' ||
		window.location.hostname === '[::1]')
const isDevEnvironment = import.meta.env?.DEV || isLocalAppHost

/**
 * Sync domain for loader (null in local dev — URLs come from sync-urls + Vite).
 * @returns {string|null}
 */
function getSyncDomain() {
	if (isDevEnvironment) return null
	return import.meta.env?.VITE_PEER_SYNC_HOST || null
}

/**
 * Secret-key dev env (`VITE_AVEN_*`): **prefer** `window.__MAIA_DEV_ENV__` over `import.meta.env`.
 * `import.meta.env` is baked at bundle time from `--env-file=.env` when the app dev-server
 * started; if `bun dev:sync` later rewrites `.env` (PEER_SYNC_SEED rotates tester creds), those
 * baked values are stale. `window.__MAIA_DEV_ENV__` is populated from `/__maia_env`, which reads
 * `.env` fresh on every request, so it always reflects the latest rotation.
 */
function getSecretKeyDevEnv() {
	const devEnv = (typeof window !== 'undefined' ? window.__MAIA_DEV_ENV__ : null) ?? null
	const buildEnv = (typeof import.meta !== 'undefined' ? import.meta.env : null) ?? null
	const pick = (key) => {
		const v = devEnv?.[key]
		if (typeof v === 'string' && v !== '') return v
		const b = buildEnv?.[key]
		if (typeof b === 'string' && b !== '') return b
		return ''
	}
	return {
		VITE_AVEN_TEST_MODE: pick('VITE_AVEN_TEST_MODE'),
		VITE_AVEN_TEST_ACCOUNT: pick('VITE_AVEN_TEST_ACCOUNT'),
		VITE_AVEN_TEST_SECRET: pick('VITE_AVEN_TEST_SECRET'),
		VITE_AVEN_TEST_NAME: pick('VITE_AVEN_TEST_NAME'),
		DEV: devEnv?.DEV === true || buildEnv?.DEV === true,
	}
}

/**
 * `VITE_AVEN_TEST_MODE`: secret-key dev sign-in for **human** operators (browser, no WebAuthn).
 * Same app as passkey users; uses pre-provisioned `AgentSecret` from env. Not the sync server Maia agent.
 * NEVER allowed in production — gated by env + localhost.
 */
function isSecretKeyDevSignInEnabled() {
	const env = getSecretKeyDevEnv()
	if (env.VITE_AVEN_TEST_MODE !== 'true') return false
	const isLocal =
		env.DEV ||
		(typeof window !== 'undefined' &&
			(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
	return isLocal
}

/** Base URL for sync HTTP API (signup, register, extend-capability). */
function getSyncBaseUrl() {
	return getSyncHttpBaseUrl({
		dev: isDevEnvironment,
		syncDomain: getSyncDomain(),
		vitePeerSyncHost: import.meta.env?.VITE_PEER_SYNC_HOST,
		windowLocation: typeof window !== 'undefined' ? window.location : null,
	})
}

async function readProfileIdForAccount(maia, accountCoId) {
	try {
		const accountStore = await maia.do({ op: 'read', factory: '@account', key: accountCoId })
		const v = accountStore?.value ?? accountStore
		const p = v?.profile
		return p?.startsWith?.('co_z') ? p : null
	} catch {
		return null
	}
}

/**
 * User-facing subtitle shown in the loading overlay, keyed by bootstrap phase.
 * Keep terse + human-friendly; the phase id is the source of truth for diagnostics/tests.
 */
const BOOTSTRAP_PHASE_SUBTITLES = Object.freeze({
	[BOOTSTRAP_PHASES.INIT]: 'Setting up your sovereign self…',
	[BOOTSTRAP_PHASES.CONNECTING_SYNC]: 'Connecting to sync…',
	[BOOTSTRAP_PHASES.LOADING_ACCOUNT]: 'Loading account…',
	[BOOTSTRAP_PHASES.HANDSHAKE]: 'Handshaking with sync server…',
	[BOOTSTRAP_PHASES.ANCHORING_SPARKS]: 'Anchoring sparks…',
	[BOOTSTRAP_PHASES.READING_SYSTEM_SPARK]: 'Resolving system spark…',
	[BOOTSTRAP_PHASES.INITIALIZING_MAIADB]: 'Initializing MaiaDB…',
	[BOOTSTRAP_PHASES.READY]: 'Ready.',
	[BOOTSTRAP_PHASES.FAILED]: 'Bootstrap failed.',
})

let _bootstrapPhaseUnsub = null
function _applyBootstrapPhaseToOverlay(phase) {
	const subtitleEl = document.querySelector('.loading-connecting-subtitle')
	if (!subtitleEl) return
	const text = BOOTSTRAP_PHASE_SUBTITLES[phase]
	if (text) subtitleEl.textContent = text
}

/**
 * Subscribe bootstrap phase events to the visible loading overlay subtitle.
 * Also resets phase state so each sign-in / sign-up starts from INIT.
 */
function startBootstrapPhaseOverlay() {
	resetBootstrapPhase()
	if (_bootstrapPhaseUnsub) _bootstrapPhaseUnsub()
	_bootstrapPhaseUnsub = subscribeBootstrapPhase(({ phase }) => _applyBootstrapPhaseToOverlay(phase))
}

function stopBootstrapPhaseOverlay() {
	if (_bootstrapPhaseUnsub) {
		_bootstrapPhaseUnsub()
		_bootstrapPhaseUnsub = null
	}
}

async function refreshMemberSyncState(maia) {
	try {
		if (!maia || detectMode() === 'agent') {
			updateSyncState({ local: 'ready', member: 'approved', writeEnabled: true })
			return
		}
		const id = authState.accountID
		if (!id?.startsWith('co_z')) return
		const grants = await loadCapabilitiesGrants(maia)
		const nowSec = Math.floor(Date.now() / 1000)
		const hasWrite = grants.some((g) => g.sub === id && g.cmd === '/sync/write' && g.exp > nowSec)
		updateSyncState({
			local: 'ready',
			member: hasWrite ? 'approved' : 'pending',
			writeEnabled: hasWrite,
		})
	} catch (_e) {
		updateSyncState({ local: 'ready', member: 'unknown', writeEnabled: true })
	}
}

/**
 * Secret-key dev sign-in (local only): human operator, env `VITE_AVEN_TEST_*`, no passkeys.
 * NEVER in production (isSecretKeyDevSignInEnabled gates this).
 *
 * Unified bootstrap: loadOrCreateAgentAccount -> bootstrapAccountHandshake -> MaiaOS.boot,
 * all awaited. No fire-and-forget .then chains — the loading overlay stays accurate,
 * any error surfaces immediately, and there is nothing for a 60s watchdog to paper over.
 */
async function signInWithSecretKeyDev() {
	if (!isSecretKeyDevSignInEnabled()) {
		showToast('Secret key dev sign-in is not available.', 'error')
		return
	}
	const env = getSecretKeyDevEnv()
	const accountID = env.VITE_AVEN_TEST_ACCOUNT
	const agentSecret = env.VITE_AVEN_TEST_SECRET
	if (!accountID || !agentSecret) {
		showToast(
			'VITE_AVEN_TEST_ACCOUNT and VITE_AVEN_TEST_SECRET required. Run `bun agent:generate` or `bun dev:sync` with PEER_SYNC_SEED=true.',
			'error',
		)
		return
	}
	try {
		setSignInLoading(true)
		const syncDomain = getSyncDomain()
		const devNameRaw = env.VITE_AVEN_TEST_NAME || 'Test'
		const devDisplayName =
			devNameRaw.startsWith('Aven ') || /\s/.test(devNameRaw) ? devNameRaw : `Aven ${devNameRaw}`

		authState = { signedIn: true, accountID }
		setupSyncSubscription()
		currentScreen = 'dashboard'
		currentContextCoValueId = null
		window.history.pushState({}, '', '/me')
		await handleRoute()

		startBootstrapPhaseOverlay()

		const { node, account } = await loadOrCreateAgentAccount({
			accountID,
			agentSecret,
			syncDomain: syncDomain || null,
			inMemory: false,
			createName: devDisplayName,
		})

		try {
			const profileId = account.get('profile')
			if (profileId) {
				const profileCore = node.getCoValue(profileId)
				if (profileCore?.isAvailable()) {
					const profile = profileCore.getCurrentContent()
					if (profile?.get('name') !== devDisplayName) {
						profile.set('name', devDisplayName)
					}
				}
			}
		} catch (_e) {}

		const baseUrl = getSyncBaseUrl()
		if (!baseUrl) throw new Error('Sync base URL not configured')
		await bootstrapAccountHandshake(account, { syncBaseUrl: baseUrl, node })

		maia = await MaiaOS.boot({
			node,
			account,
			agentSecret,
			syncDomain,
			getSyncBaseUrl,
			modules: ['db', 'core', 'ai'],
		})
		stopBootstrapPhaseOverlay()
		window.maia = maia
		void refreshMemberSyncState(maia)
		capabilityGrantsIndexColistCoId = (await getCapabilityGrantIndexColistCoId(maia)) ?? null
		initGlobalAI(maia)
		notifyMaiaReady(maia)
		cleanupLoadingScreenSync()
		if (authState.signedIn) {
			renderAppInternal().catch((e) =>
				showToast(`Failed to render app: ${caughtErrMessage(e)}`, 'error'),
			)
		}
		loadLinkedCoValues().catch(() => {})
	} catch (error) {
		stopBootstrapPhaseOverlay()
		cleanupLoadingScreenSync()
		authState = { signedIn: false, accountID: null }
		maia = null
		setSignInLoading(false)
		showToast(`Secret key dev sign-in failed: ${caughtErrMessage(error)}`, 'error', 9000)
		window.history.pushState({}, '', '/signin')
		renderSignInPrompt(
			hasExistingAccount,
			undefined,
			isSecretKeyDevSignInEnabled(),
			getSignInUiHandlers(),
		)
	}
}

/**
 * Sign in with existing passkey.
 *
 * Unified bootstrap: signInWithPasskey -> loadingPromise -> bootstrapAccountHandshake -> MaiaOS.boot,
 * all awaited in one path. Overlay subtitle tracks live bootstrap phase; failures reset auth state
 * and surface immediately instead of silently timing out.
 */
async function signIn() {
	try {
		setSignInLoading(true)
		const syncDomain = getSyncDomain()

		const { accountID, agentSecret, loadingPromise } = await signInWithPasskey({
			salt: 'maia.city',
		})

		authState = { signedIn: true, accountID }
		setupSyncSubscription()
		currentScreen = 'dashboard'
		currentContextCoValueId = null

		window.history.pushState({}, '', '/me')
		await handleRoute().catch((error) => {
			showToast(`Navigation error: ${caughtErrMessage(error)}`, 'error')
		})
		setSignInLoading(false)
		startBootstrapPhaseOverlay()

		try {
			const { node, account } = await loadingPromise
			const baseUrl = getSyncBaseUrl()
			if (!baseUrl) throw new Error('Sync base URL not configured')
			await bootstrapAccountHandshake(account, { syncBaseUrl: baseUrl, node })

			maia = await MaiaOS.boot({
				node,
				account,
				agentSecret,
				syncDomain,
				getSyncBaseUrl,
				modules: ['db', 'core', 'ai'],
			})
			stopBootstrapPhaseOverlay()
			window.maia = maia
			void refreshMemberSyncState(maia)
			capabilityGrantsIndexColistCoId = (await getCapabilityGrantIndexColistCoId(maia)) ?? null
			initGlobalAI(maia)
			notifyMaiaReady(maia)
			cleanupLoadingScreenSync()
			if (authState.signedIn) {
				renderAppInternal().catch((error) => {
					showToast(`Failed to render app: ${caughtErrMessage(error)}`, 'error')
				})
			}
			loadLinkedCoValues().catch((_error) => {})
		} catch (bootOrLoadError) {
			stopBootstrapPhaseOverlay()
			cleanupLoadingScreenSync()
			const msg = caughtErrMessage(bootOrLoadError)
			const isNotFound =
				bootOrLoadError?.isAccountNotFound ||
				msg.includes('Account not found in storage') ||
				msg.includes('Account unavailable from all peers')
			appLog.error('[app] signIn boot/load failed', {
				message: msg,
				phase: bootOrLoadError?.phase,
				isAccountNotFound: isNotFound,
				original: bootOrLoadError?.originalError?.message,
			})
			const hint = isNotFound
				? ' No record of this passkey on the sync server or in local storage. If you are a new user, choose "Create your Self" instead. If you were here before, your server data may have been reset (PEER_SYNC_SEED) — clear site data (OPFS) and sign up again.'
				: ''
			showToast(`Sign-in failed: ${msg}.${hint}`, 'error', 9000)
			authState = { signedIn: false, accountID: null }
			maia = null
			window.history.pushState({}, '', '/signin')
			renderSignInPrompt(
				hasExistingAccount,
				undefined,
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
			)
		}
	} catch (error) {
		stopBootstrapPhaseOverlay()
		authState = { signedIn: false, accountID: null }
		maia = null
		setSignInLoading(false)

		const msg = caughtErrMessage(error)
		const errName = caughtErrName(error)
		if (msg.includes('PRF not supported') || msg.includes('WebAuthn')) {
			showToast('Passkeys are not available in this browser.', 'info', 5000)
			renderSignInPrompt(
				hasExistingAccount,
				undefined,
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
				true,
			)
		} else if (
			errName === 'NotAllowedError' ||
			msg.includes('User denied permission') ||
			msg.includes('denied permission')
		) {
			showToast(
				"You cancelled the passkey prompt. Click the button again when you're ready.",
				'info',
				5000,
			)
			renderSignInPrompt(
				hasExistingAccount,
				undefined,
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
			)
		} else {
			const friendlyMessage = msg.includes('Failed to evaluate PRF')
				? 'Unable to authenticate with your passkey. Please try again.'
				: msg
			showToast(friendlyMessage, 'error', 7000)
			renderSignInPrompt(hasExistingAccount, undefined, false, getSignInUiHandlers())
		}
	}
}

/** Load linked CoValues from account (sparks registry via deep resolution) */
async function loadLinkedCoValues() {
	if (!maia?.id?.maiaId) return
	try {
		const accountStore = await maia.do({ op: 'read', factory: '@account', key: maia.id.maiaId.id })
		const accountData = accountStore?.value ?? accountStore
		const sparksId = accountData?.sparks
		if (typeof sparksId === 'string' && sparksId.startsWith('co_')) {
			await maia.do({ op: 'read', factory: sparksId, key: sparksId, deepResolve: true })
		}
	} catch (_e) {}
}

/**
 * Register new passkey.
 *
 * Unified bootstrap path: same as signIn but with signUpWithPasskey at the front.
 */
async function register() {
	try {
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

		setSignInLoading(true)
		const syncDomain = getSyncDomain()

		const firstName = getFirstNameForRegister()
		const name = firstName && firstName.length <= 50 ? firstName.trim() : undefined

		const { accountID, loadingPromise } = await signUpWithPasskey({
			name,
			salt: 'maia.city',
		})

		authState = { signedIn: true, accountID }
		setupSyncSubscription()
		currentScreen = 'dashboard'
		currentContextCoValueId = null
		window.history.pushState({}, '', '/me')
		await handleRoute().catch((error) => {
			showToast(`Navigation error: ${caughtErrMessage(error)}`, 'error')
		})

		setSignInLoading(false)
		startBootstrapPhaseOverlay()

		try {
			const { node, account } = await loadingPromise
			const baseUrl = getSyncBaseUrl()
			if (!baseUrl) throw new Error('Sync base URL not configured')
			await bootstrapAccountHandshake(account, { syncBaseUrl: baseUrl, node })

			maia = await MaiaOS.boot({
				node,
				account,
				syncDomain,
				getSyncBaseUrl,
				modules: ['db', 'core', 'ai'],
			})
			stopBootstrapPhaseOverlay()
			window.maia = maia
			void refreshMemberSyncState(maia)
			capabilityGrantsIndexColistCoId = (await getCapabilityGrantIndexColistCoId(maia)) ?? null
			initGlobalAI(maia)
			notifyMaiaReady(maia)
			cleanupLoadingScreenSync()
			if (authState.signedIn) {
				renderAppInternal().catch((e) =>
					showToast(`Failed to render app: ${caughtErrMessage(e)}`, 'error'),
				)
			}
			loadLinkedCoValues().catch(() => {})
		} catch (bootError) {
			stopBootstrapPhaseOverlay()
			cleanupLoadingScreenSync()
			authState = { signedIn: false, accountID: null }
			maia = null
			capabilityGrantsIndexColistCoId = null
			setSignInLoading(false)
			appLog.error('[app] register boot failed', {
				message: caughtErrMessage(bootError),
				phase: bootError?.phase,
			})
			showToast(`Failed to initialize MaiaOS: ${caughtErrMessage(bootError)}`, 'error', 9000)
			window.history.pushState({}, '', '/signup')
			renderSignInPrompt(hasExistingAccount, undefined, false, getSignInUiHandlers())
		}
	} catch (error) {
		setSignInLoading(false)
		const msg = caughtErrMessage(error)
		const errName = caughtErrName(error)
		if (msg.includes('PRF not supported') || msg.includes('WebAuthn')) {
			showToast('Passkeys are not available in this browser.', 'info', 5000)
			renderSignInPrompt(
				hasExistingAccount,
				'signup',
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
				true,
			)
		} else if (
			errName === 'NotAllowedError' ||
			msg.includes('User denied permission') ||
			msg.includes('denied permission')
		) {
			showToast(
				"You cancelled the passkey prompt. Click the button again when you're ready.",
				'info',
				5000,
			)
			renderSignInPrompt(
				hasExistingAccount,
				'signup',
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
			)
		} else {
			const friendlyMessage = msg.includes('Failed to create passkey')
				? 'Unable to create passkey. Please try again.'
				: msg
			showToast(friendlyMessage, 'error', 7000)
			renderSignInPrompt(
				hasExistingAccount,
				'signup',
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
			)
		}
	}
}

function signOut() {
	disposeGlobalAI()
	if (unsubscribeSync) {
		unsubscribeSync()
		unsubscribeSync = null
	}
	authState = { signedIn: false, accountID: null }
	syncState = { connected: false, syncing: false, error: null, status: null }
	updateSyncState({
		writeEnabled: true,
		local: 'empty',
		member: 'unknown',
	})
	maia = null
	capabilityGrantsIndexColistCoId = null

	// DON'T clear the account flag - passkey still exists on device!
	// User can still sign back in, so UI should show "Sign In" as primary
	window.location.reload()
}

// Store loading screen sync subscription
let loadingScreenSyncUnsubscribe = null

const LOADING_SCREEN_HTML = (syncMessage, indicatorStyle) => `
	<div class="db-container">
		<div class="navbar-section">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<span class="db-header-maia-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.5"/><path fill="currentColor" d="M8.575 9.447C8.388 7.363 6.781 5.421 6 4.711l-.43-.37A9.96 9.96 0 0 1 12 2c2.214 0 4.26.72 5.916 1.936c.234.711-.212 2.196-.68 2.906c-.17.257-.554.577-.976.88c-.95.683-2.15 1.02-2.76 2.278a1.42 1.42 0 0 0-.083 1.016c.06.22.1.459.1.692c.002.755-.762 1.3-1.517 1.292c-1.964-.021-3.25-1.604-3.425-3.553m4.862 8.829c.988-1.862 4.281-1.862 4.281-1.862c3.432-.036 3.896-2.12 4.206-3.173a10.006 10.006 0 0 1-8.535 8.664c-.323-.68-.705-2.21.048-3.629"/></svg></span>
						<h1>Maia OS</h1>
					</div>
					<div class="header-center">
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right"></div>
				</div>
			</header>
		</div>
		<div class="dashboard-main">
			<div class="dashboard-grid">
				<div class="dashboard-card whitish-card skeleton-card">
					<div class="dashboard-card-content">
						<div class="dashboard-card-icon"></div>
						<h3 class="dashboard-card-title"></h3>
						<p class="dashboard-card-description"></p>
					</div>
				</div>
				<div class="dashboard-card whitish-card skeleton-card">
					<div class="dashboard-card-content">
						<div class="dashboard-card-icon"></div>
						<h3 class="dashboard-card-title"></h3>
						<p class="dashboard-card-description"></p>
					</div>
				</div>
				<div class="dashboard-card whitish-card skeleton-card">
					<div class="dashboard-card-content">
						<div class="dashboard-card-icon"></div>
						<h3 class="dashboard-card-title"></h3>
						<p class="dashboard-card-description"></p>
					</div>
				</div>
				<div class="dashboard-card whitish-card skeleton-card">
					<div class="dashboard-card-content">
						<div class="dashboard-card-icon"></div>
						<h3 class="dashboard-card-title"></h3>
						<p class="dashboard-card-description"></p>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="loading-connecting-overlay loading-skeleton-overlay">
		${accountLoadingSpinnerHtml}
		<div class="loading-connecting-content">
			<h2>Initializing your account</h2>
			<div class="loading-connecting-subtitle">Setting up your sovereign self…</div>
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
	const isReadOnly =
		syncState.connected &&
		(syncState.writeEnabled === false ||
			syncState.member === 'pending' ||
			syncState.member === 'unknown')
	const hasError = syncState.status === 'error' || syncState.error
	const indicatorColor = isConnected
		? isReadOnly
			? 'var(--color-sun-yellow)'
			: 'var(--color-lush-green)'
		: hasError
			? 'var(--brand-red)'
			: 'var(--color-sun-yellow)'
	const indicatorStyle = `background: ${indicatorColor}; animation: ${isConnected && !isReadOnly ? 'none' : 'pulse 2s ease-in-out infinite'};`
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
		const isReadOnly =
			syncState.connected &&
			(syncState.writeEnabled === false ||
				syncState.member === 'pending' ||
				syncState.member === 'unknown')
		const hasError = syncState.status === 'error' || syncState.error
		const color = isConnected
			? isReadOnly
				? 'var(--color-sun-yellow)'
				: 'var(--color-lush-green)'
			: hasError
				? 'var(--brand-red)'
				: 'var(--color-sun-yellow)'
		syncIndicator.style.background = color
		syncIndicator.style.animation =
			isConnected && !isReadOnly ? 'none' : 'pulse 2s ease-in-out infinite'
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

// Navigation function for screen transitions
// @param {string} screen - Screen to navigate to
// @param {Object} [options] - Options
// @param {boolean} [options.preserveSpark] - If true, keep currentSpark (Home from aven → avens grid, not sparks root)
function navigateToScreen(screen, options = {}) {
	currentScreen = screen
	if (screen === 'dashboard') {
		currentVibe = null
		currentContextCoValueId = null
		syncServerSelectedTable = null
		syncServerTableOffset = 0
		if (!options.preserveSpark) {
			currentSpark = null
		}
		navigationHistory = []
	}
	renderAppInternal()
}

/**
 * Load a spark context (grid hierarchy level 1 → level 2)
 * @param {string|null} spark - Spark name (e.g. '°maia') or null to go back to sparks level
 */
function loadSpark(spark) {
	currentSpark = spark
	// Stay on dashboard, just re-render with new level
	currentScreen = 'dashboard'
	renderAppInternal()
}

// switchView moved above selectCoValue

function selectCoValueInternal(coId, skipHistory = false) {
	syncServerSelectedTable = null
	syncServerTableOffset = 0
	// Collapse detail (right) only so Explorer (Account / Capabilities) stays discoverable on the left
	collapseDbMetadataSidebar()

	// If we're in agent mode and selecting account, exit agent mode first
	if (currentVibe !== null && coId === maia?.id?.maiaId?.id) {
		currentVibe = null
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
	if (coId?.startsWith('co_z') && maia?.do) {
		try {
			const profiles = await resolveAccountCoIdsToProfiles(maia, [coId])
			const profileId = profiles.get(coId)?.id
			if (profileId) targetCoId = profileId
		} catch (_e) {}
	}
	selectCoValueInternal(targetCoId, skipHistory)
}

/** Right metadata panel only — keeps left Explorer (incl. Capabilities) visible. */
function collapseDbMetadataSidebar() {
	const dbMetadata = document.querySelector('.db-metadata')
	if (dbMetadata) {
		dbMetadata.classList.add('collapsed')
	}
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
	const agentContainer = document.querySelector('.vibe-container')
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
	if (currentVibe !== null) {
		loadVibe(null)
		return
	}

	// If we're in Maia AI, go to dashboard
	if (currentScreen === 'maia-ai') {
		navigateToScreen('dashboard')
		return
	}

	if (currentScreen === 'the-game') {
		navigateToScreen('dashboard')
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
	syncServerSelectedTable = null
	syncServerTableOffset = 0
	navigationHistory = [] // Clear navigation history when switching views
	currentScreen = 'maia-db' // Ensure we're in DB viewer when switching views
	renderAppInternal()
}

function selectSyncServerTable(tableName) {
	if (typeof tableName !== 'string' || !tableName.trim()) return
	collapseAllSidebars()
	syncServerSelectedTable = tableName.trim()
	syncServerTableOffset = 0
	currentContextCoValueId = null
	currentScreen = 'maia-db'
	navigationHistory = []
	renderAppInternal()
}

/** Clear SYNC SERVER selection when inspector is not allowed (keeps main state in sync with db-view probe). */
function clearSyncServerSelectionIfDenied() {
	syncServerSelectedTable = null
	syncServerTableOffset = 0
}

async function renderAppInternal() {
	if (isRendering) {
		pendingRender = true
		return
	}

	isRendering = true

	try {
		// Boot can run before peer.infra + indexes exist; refresh so Explorer shows Capabilities link
		if (
			maia &&
			authState.signedIn &&
			currentScreen === 'maia-db' &&
			!capabilityGrantsIndexColistCoId
		) {
			capabilityGrantsIndexColistCoId = (await getCapabilityGrantIndexColistCoId(maia)) ?? null
		}
		await renderApp(
			maia,
			authState,
			syncState,
			currentScreen,
			currentView,
			currentContextCoValueId,
			currentVibe,
			currentSpark,
			switchView,
			selectCoValue,
			loadVibe,
			loadSpark,
			navigateToScreen,
			capabilityGrantsIndexColistCoId,
			syncServerSelectedTable,
			syncServerTableOffset,
			clearSyncServerSelectionIfDenied,
		)
		// Update unified nav left button: always "home", action = go to dashboard when not on dashboard
		if (currentScreen === 'dashboard') {
			updateNavLeft('home', null)
		} else if (currentScreen === 'vibe-viewer') {
			updateNavLeft('home', () => loadVibe(null))
		} else if (currentScreen === 'maia-db') {
			updateNavLeft('home', () => navigateToScreen('dashboard'))
		} else if (currentScreen === 'the-game') {
			if (window.location.pathname === '/game' && isGameDevRouteEnabled()) {
				updateNavLeft('home', () => {
					currentScreen = 'dashboard'
					navigateTo(authState.signedIn && maia ? '/me' : '/')
				})
			} else {
				updateNavLeft('home', () => navigateToScreen('dashboard'))
			}
		}
	} finally {
		isRendering = false
		if (pendingRender) {
			pendingRender = false
			void renderAppInternal()
		}
	}
}

/**
 * Revoke a capability grant by setting exp to past. Requires write access to the capability CoMap.
 * @param {string} capabilityId - Co-id of the capability grant to revoke
 * @param {{ cmd?: string, sub?: string }} [grant] - Optional grant info; if cmd is /sync/write and sub is current account, updates sync writeEnabled
 */
async function revokeCapability(capabilityId, grant = {}) {
	const m = maia ?? window.maia
	if (!m) {
		showToast('Maia not ready', 'error')
		return
	}
	try {
		await m.do({
			op: 'update',
			id: capabilityId,
			data: { exp: Math.floor(Date.now() / 1000) - 1 },
		})
		if (grant?.cmd === '/sync/write' && grant?.sub === authState.accountID) {
			updateSyncState({ writeEnabled: false })
		}
		showToast('Capability revoked', 'success')
		await renderAppInternal()
	} catch (error) {
		showToast(`Failed to revoke: ${error?.message ?? error}`, 'error')
	}
}

/**
 * Extend a capability grant by 1 day. For expired capabilities, re-enables from now.
 * Uses server endpoint to avoid chicken-and-egg (client needs /sync/write to sync the update).
 * @param {string} capabilityId - Co-id of the capability grant
 * @param {number} [currentExp=0] - Unused; server computes new exp from capability
 */
async function extendCapability(capabilityId, _currentExp = 0) {
	const m = maia ?? window.maia
	if (!m) {
		showToast('Maia not ready', 'error')
		return
	}
	const baseUrl = getSyncBaseUrl()
	if (!baseUrl) {
		showToast('Sync server not configured', 'error')
		return
	}
	try {
		const token = await m.getCapabilityToken({
			cmd: '/extend-capability',
			args: { capabilityId },
		})
		const res = await fetch(`${baseUrl}/extend-capability`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ capabilityId }),
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok) {
			showToast(data?.error ?? `Failed to extend: ${res.status}`, 'error')
			return
		}
		showToast('Capability extended', 'success')
		await renderAppInternal()
	} catch (error) {
		showToast(`Failed to extend: ${error?.message ?? error}`, 'error')
	}
}

/**
 * Grant /sync/write + /llm/chat for a human account (guardian approval).
 */
async function grantMemberCapabilities(targetAccountId) {
	const m = maia ?? window.maia
	if (!m?.dataEngine?.peer) {
		showToast('Maia not ready', 'error')
		return
	}
	const peer = m.dataEngine.peer
	try {
		validateInvite(peer, null, { sub: targetAccountId })
		const profileId = await readProfileIdForAccount(m, targetAccountId)
		if (!profileId) {
			showToast('Could not load profile for that account — user must sign up and sync first.', 'error')
			return
		}
		await ensureIdentity({
			peer,
			dataEngine: m.dataEngine,
			type: 'human',
			accountId: targetAccountId,
			profileId,
		})
		const grants = await loadCapabilitiesGrants(m)
		const nowSec = Math.floor(Date.now() / 1000)
		const exp = nowSec + CAP_GRANT_TTL_SECONDS
		await m.dataEngine.resolveSystemFactories?.()
		let factory = peer.infra?.capability
		if (!factory?.startsWith('co_z')) {
			await m.dataEngine.resolveSystemFactories?.()
			factory = peer.infra?.capability
		}
		if (!factory?.startsWith('co_z')) {
			showToast('Capability factory not available', 'error')
			return
		}
		const spark = peer.systemSparkCoId
		if (!spark?.startsWith('co_z')) {
			showToast('Spark not ready', 'error')
			return
		}
		for (const cmd of ['/sync/write', '/llm/chat']) {
			const existing = grants.find((g) => g.sub === targetAccountId && g.cmd === cmd && g.exp > nowSec)
			if (existing) {
				await m.do({ op: 'update', id: existing.id, data: { exp } })
			} else {
				await m.do({
					op: 'create',
					factory,
					data: { sub: targetAccountId, cmd, pol: [], exp },
					spark,
				})
			}
		}
		showToast('Member approved', 'success')
		void refreshMemberSyncState(m)
		await renderAppInternal()
	} catch (error) {
		showToast(`Approve failed: ${error?.message ?? error}`, 'error')
	}
}

async function revokeMemberCapabilities(targetAccountId) {
	const m = maia ?? window.maia
	if (!m?.dataEngine?.peer) {
		showToast('Maia not ready', 'error')
		return
	}
	try {
		const grants = await loadCapabilitiesGrants(m)
		const nowSec = Math.floor(Date.now() / 1000)
		const past = nowSec - 1
		const toRevoke = grants.filter(
			(g) =>
				g.sub === targetAccountId &&
				(g.cmd === '/sync/write' || g.cmd === '/llm/chat') &&
				g.exp > nowSec,
		)
		for (const g of toRevoke) {
			await m.do({ op: 'update', id: g.id, data: { exp: past } })
		}
		showToast('Member access revoked', 'success')
		void refreshMemberSyncState(m)
		await renderAppInternal()
	} catch (error) {
		showToast(`Revoke failed: ${error?.message ?? error}`, 'error')
	}
}

/**
 * @param {string} vibeCoId - Vibe CoMap co-id (co_z...)
 * @param {string} [_sparkCoId] - Reserved (spark is implicit on peer.systemSparkCoId)
 */
function loadVibeWithSpark(vibeCoId, _sparkCoId) {
	void _sparkCoId
	loadVibe(vibeCoId)
}

/**
 * Load an aven inline in the main context area
 * @param {string|null} vibeCoId - Vibe CoMap co-id (co_z...) or null to exit aven mode
 */
async function loadVibe(vibeCoId) {
	if (!maia && vibeCoId !== null) {
		return
	}

	if (vibeCoId !== null && typeof vibeCoId !== 'string') {
		return
	}
	if (vibeCoId !== null && !vibeCoId.startsWith('co_z')) {
		return
	}

	const perf = createPerfTracer('app', 'vibes')
	try {
		perf.start(`loadVibe(${vibeCoId === null ? 'close' : vibeCoId})`)
		if (typeof window !== 'undefined' && window._maiaDebugFreeze) {
		}
		if (vibeCoId === null) {
			if (currentVibe && maia?.runtime) {
				maia.runtime.destroyActorsForVibe(currentVibe)
				perf.step('destroyActorsForVibe(close)')
			}

			currentVibe = null
			// Match navigateToScreen('dashboard') state but do not call render here — that would race
			// the awaited renderAppInternal below (second call returns early while isRendering).
			currentScreen = 'dashboard'
			currentContextCoValueId = null
			currentSpark = null
			navigationHistory = []
			perf.step('state→dashboard')
		} else {
			if (currentVibe && currentVibe !== vibeCoId && maia?.runtime) {
				maia.runtime.destroyActorsForVibe(currentVibe)
				perf.step('destroyActorsForVibe(switch)')
			}

			if (currentContextCoValueId !== null) {
				navigationHistory.push(currentContextCoValueId)
			}
			currentVibe = vibeCoId
			currentContextCoValueId = null
			currentScreen = 'vibe-viewer'
			perf.step('state→vibe-viewer')
		}

		await perf.measure('renderAppInternal', async () => renderAppInternal())
		if (vibeCoId === null) {
			await waitUntilNextPaint()
			perf.step('afterPaint(dashboard)')
		}
		perf.end('loadVibe')
		if (typeof window !== 'undefined' && window._maiaDebugFreeze) {
		}
	} catch (error) {
		perf.end('loadVibe(error)')
		currentVibe = null
		// Must reset screen: vibe-viewer + null currentVibe falls through to default MaiaDB in renderApp.
		currentScreen = 'dashboard'
		currentContextCoValueId = null
		showToast(`Failed to open vibe: ${error?.message ?? error}`, 'error')
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

/** Load CoValue by ID from sidebar input (Maia DB). */
function loadCoValueById() {
	const input = document.getElementById('coid-search-input')
	if (!input) return
	const coId = (input.value || '').trim()
	if (!coId.startsWith('co_z')) {
		showToast('Enter a valid co-id (starts with co_z)', 'info', 3000)
		return
	}
	selectCoValue(coId)
	input.value = ''
}

let isMobileMenuOpen = false

function toggleMobileMenu() {
	isMobileMenuOpen = !isMobileMenuOpen
	const menu = document.getElementById('mobile-menu')
	if (!menu) return
	menu.classList.toggle('active', isMobileMenuOpen)
	const trigger = document.querySelector('.account-menu-toggle')
	if (trigger) trigger.classList.toggle('active', isMobileMenuOpen)
}

/** Toggle sidebar (DB viewer or aven viewer). Pass containerSelector for Shadow DOM. */
function toggleSidebar(sidebarSelector, otherSidebarSelector, containerSelector, latchId) {
	const root = containerSelector ? document.querySelector(containerSelector)?.shadowRoot : document
	if (!root) return
	const sidebar = root.querySelector(sidebarSelector)
	if (!sidebar) return
	sidebar.classList.add('sidebar-ready')
	sidebar.classList.toggle('collapsed')

	const isCollapsed = sidebar.classList.contains('collapsed')
	if (latchId) {
		const latch = document.getElementById(latchId)
		if (latch) latch.classList.toggle('active', !isCollapsed)
	}

	const other = root.querySelector(otherSidebarSelector)
	if (other && !isCollapsed) {
		other.classList.add('sidebar-ready')
		other.classList.add('collapsed')
		// If we opened one, we closed the other - update other latch if it exists
		const otherLatchId = latchId?.includes('left')
			? latchId.replace('left', 'right')
			: latchId?.replace('right', 'left')
		if (otherLatchId) {
			const otherLatch = document.getElementById(otherLatchId)
			if (otherLatch) otherLatch.classList.remove('active')
		}
	}
}

function toggleDBLeftSidebar() {
	toggleSidebar('.db-sidebar', '.db-metadata', null, 'db-latch-left')
}
function toggleDBRightSidebar() {
	toggleSidebar('.db-metadata', '.db-sidebar', null, 'db-latch-right')
}

function getSignInUiHandlers() {
	return {
		register,
		signIn,
		signInWithSecretKeyDev,
		switchToSignin: () =>
			renderSignInPrompt(
				hasExistingAccount,
				'signin',
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
			),
		switchToSignup: () =>
			renderSignInPrompt(
				hasExistingAccount,
				'signup',
				isSecretKeyDevSignInEnabled(),
				getSignInUiHandlers(),
			),
	}
}

function setupMaiaAppDelegation() {
	const app = document.getElementById('app')
	if (!app || app.dataset.maiaDelegationBound) return
	app.dataset.maiaDelegationBound = '1'

	app.addEventListener('submit', (e) => {
		const form = e.target
		if (!(form instanceof HTMLFormElement) || form.id !== 'intro-form') return
		e.preventDefault()
		const raw = document.getElementById('intro-name')
		const name = raw && typeof raw.value === 'string' ? raw.value.trim() : ''
		if (name.length > 0) {
			sessionStorage.setItem('maia_intro_first_name', name)
		} else {
			sessionStorage.removeItem('maia_intro_first_name')
		}
		void beginIntroDiary()
	})

	app.addEventListener('click', (e) => {
		const el = e.target.closest('[data-maia-action]')
		if (!el) return
		const action = el.dataset.maiaAction
		if (action === 'navigateTo') {
			e.preventDefault()
			navigateTo(el.dataset.path || '/')
			return
		}
		if (action === 'selectCoValue') {
			const id = el.dataset.coid
			if (id) void selectCoValue(id)
			return
		}
		if (action === 'selectSyncServerTable') {
			const t = el.dataset.table
			if (t) selectSyncServerTable(t)
			return
		}
		if (action === 'syncServerPagePrev') {
			syncServerPagePrev()
			return
		}
		if (action === 'syncServerPageNext') {
			syncServerPageNext()
			return
		}
		if (action === 'toggleExpand') {
			e.stopPropagation()
			const id = el.dataset.expandId
			if (id) toggleExpand(id)
			return
		}
		if (action === 'extendCapability') {
			const capId = el.dataset.capId
			if (capId) void extendCapability(capId, Number(el.dataset.capExp) || 0)
			return
		}
		if (action === 'revokeCapability') {
			const id = el.dataset.revokeId
			if (id) void revokeCapability(id, { cmd: el.dataset.cmd, sub: el.dataset.sub })
			return
		}
		if (action === 'capabilitiesSubTab') {
			const subtab = el.dataset.subtab
			if (!subtab) return
			const wrap = el.closest('.capabilities-table-wrap')
			if (!wrap) return
			for (const btn of wrap.querySelectorAll('[data-maia-action="capabilitiesSubTab"]')) {
				btn.classList.toggle('capabilities-subtab-active', btn.dataset.subtab === subtab)
				btn.setAttribute('aria-selected', btn.dataset.subtab === subtab ? 'true' : 'false')
			}
			for (const panel of wrap.querySelectorAll('[data-subtab-panel]')) {
				const isActive = panel.getAttribute('data-subtab-panel') === subtab
				panel.classList.toggle('capabilities-subtab-panel-hidden', !isActive)
				panel.setAttribute('data-capabilities-active', isActive ? 'true' : 'false')
			}
			return
		}
		if (action === 'approveMember') {
			const aid = el.dataset.accountId
			if (aid) void grantMemberCapabilities(aid)
			return
		}
		if (action === 'revokeMember') {
			const aid = el.dataset.accountId
			if (aid) void revokeMemberCapabilities(aid)
			return
		}
		if (action === 'copyId') {
			const id = el.dataset.copyId
			if (id) {
				navigator.clipboard.writeText(id).then(() => {
					el.textContent = '✓'
					setTimeout(() => {
						el.textContent = '⎘'
					}, 800)
				})
			}
			return
		}
		if (action === 'toggleMobileMenu') {
			toggleMobileMenu()
			return
		}
		if (action === 'signOut') {
			signOut()
			toggleMobileMenu()
			return
		}
		if (action === 'loadCoValueById') {
			loadCoValueById()
			return
		}
		if (action === 'toggleDBLeftSidebar') {
			toggleDBLeftSidebar()
			return
		}
		if (action === 'toggleDBRightSidebar') {
			toggleDBRightSidebar()
			return
		}
		if (action === 'goBack') {
			goBack()
			return
		}
		if (action === 'navigateToScreen') {
			const screen = el.dataset.screen
			if (screen) navigateToScreen(screen)
			return
		}
		if (action === 'loadVibeWithSpark') {
			const vc = el.dataset.vibeCoid
			if (vc) loadVibeWithSpark(vc, el.dataset.sparkCoid)
			return
		}
		if (action === 'toggleMetadataInternalKey') {
			toggleMetadataInternalKey(el)
			return
		}
		if (action === 'register') {
			void register()
			return
		}
		if (action === 'signIn') {
			void signIn()
			return
		}
		if (action === 'signInWithSecretKeyDev') {
			void signInWithSecretKeyDev()
			return
		}
		if (action === 'switchToSignin') {
			e.preventDefault()
			getSignInUiHandlers().switchToSignin()
			return
		}
		if (action === 'switchToSignup') {
			e.preventDefault()
			getSignInUiHandlers().switchToSignup()
			return
		}
	})

	app.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter') return
		const t = e.target
		if (t && t.id === 'coid-search-input') {
			e.preventDefault()
			loadCoValueById()
		}
	})
}

init()
