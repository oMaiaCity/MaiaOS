import { accountLoadingSpinnerHtml } from './account-loading-spinner-html.js'
import { getSyncStatusMessage } from './utils.js'

/**
 * @param {object} options
 * @param {() => object} options.getSyncState
 * @param {(next: object) => void} options.setSyncState
 * @param {(fn: (state: object) => void) => () => void} options.subscribeSyncState
 */
export function createLoadingScreenController({ getSyncState, setSyncState, subscribeSyncState }) {
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

	function renderLoadingConnectingScreen() {
		const syncState = getSyncState()
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
				setSyncState(state)
				updateLoadingConnectingScreen()
			})
		}
	}

	function updateLoadingConnectingScreen() {
		const syncState = getSyncState()
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

	function cleanupLoadingScreenSync() {
		if (loadingScreenSyncUnsubscribe) {
			loadingScreenSyncUnsubscribe()
			loadingScreenSyncUnsubscribe = null
		}
	}

	return {
		renderLoadingConnectingScreen,
		updateLoadingConnectingScreen,
		cleanupLoadingScreenSync,
	}
}
