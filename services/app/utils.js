/**
 * Utility functions for Maia City
 */

export function truncate(str, maxLen = 40) {
	if (typeof str !== 'string') return str
	if (str.length <= maxLen) return str
	return `${str.substring(0, maxLen)}...`
}

export function truncateWords(text, maxWords = 10) {
	if (!text) return ''
	const words = String(text).trim().split(/\s+/)
	if (words.length <= maxWords) return text
	return `${words.slice(0, maxWords).join(' ')}...`
}

export function escapeHtml(text) {
	if (text === null || text === undefined) return ''
	const div = document.createElement('div')
	div.textContent = String(text)
	return div.innerHTML
}

/**
 * Get sync status message based on status field
 * @param {Object} syncState - Sync state object with status field
 * @param {string} [defaultMsg='Offline'] - Message when status is unknown (e.g. 'Connecting to sync...')
 * @returns {string} Status message
 */
export function getSyncStatusMessage(syncState, defaultMsg = 'Offline') {
	if (syncState.status === 'authenticating') return 'Authenticating...'
	if (syncState.status === 'loading-account') return 'Loading your account...'
	if (syncState.status === 'syncing') return 'Syncing data...'
	if (syncState.status === 'connected')
		return syncState.writeEnabled === false ? 'Read-only' : 'Connected'
	if (syncState.status === 'error') return syncState.error || 'Error'
	if (syncState.connected) {
		if (syncState.writeEnabled === false) return 'Read-only'
		return syncState.syncing ? 'Syncing' : 'Connected'
	}
	if (syncState.error) return syncState.error
	return defaultMsg
}

/**
 * Get sync status CSS class for the dot indicator (connected | read-only | disconnected)
 * @param {Object} syncState - Sync state object
 * @returns {string} Status class
 */
export function getSyncStatusClass(syncState) {
	if (syncState.connected) {
		return syncState.writeEnabled === false ? 'read-only' : 'connected'
	}
	return 'disconnected'
}

const AVATAR_FALLBACK_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="avatar-fallback-svg"><path fill="currentColor" d="M8.113 13.888Q7.75 13.525 7.75 13t.363-.888T9 11.75t.888.363t.362.887t-.363.888T9 14.25t-.888-.363m6 0q-.362-.362-.362-.887t.363-.888t.887-.362t.888.363t.362.887t-.363.888t-.887.362t-.888-.363M12 20q3.35 0 5.675-2.325T20 12q0-.6-.075-1.162T19.65 9.75q-.525.125-1.05.188T17.5 10q-2.275 0-4.3-.975T9.75 6.3q-.8 1.95-2.287 3.388T4 11.85V12q0 3.35 2.325 5.675T12 20m.003 1q-1.867 0-3.51-.708q-1.643-.709-2.859-1.923t-1.925-2.857T3 12.003t.709-3.51T5.63 5.634t2.857-1.925T11.997 3t3.51.709t2.859 1.922t1.925 2.857t.709 3.509t-.708 3.51t-1.924 2.859t-2.856 1.925t-3.509.709"/></svg>'

function getAvatarFallbackHtml(className = 'navbar-avatar') {
	return `<span class="${className} avatar-fallback" aria-hidden="true">${AVATAR_FALLBACK_SVG}</span>`
}

/**
 * Generic profile avatar HTML (image or fallback). Use everywhere profile pictures are displayed.
 * @param {string|null|undefined} imageCoId - CoBinary co-id for profile image, or null/undefined for fallback
 * @param {{ size?: number, className?: string, syncState?: Object }} [options] - size (default 44), className (default 'navbar-avatar'), syncState
 * @returns {string} HTML for img or fallback SVG
 */
export function getProfileAvatarHtml(imageCoId, options = {}) {
	const { size = 44, className = 'navbar-avatar', syncState = null } = options
	const syncClass = syncState ? getSyncStatusClass(syncState) : ''
	const fullClassName = `${className} ${syncClass}`.trim()

	if (imageCoId && typeof imageCoId === 'string' && imageCoId.startsWith('co_z')) {
		return `<img class="${fullClassName}" data-co-id="${escapeHtml(imageCoId)}" alt="" width="${size}" height="${size}" />`
	}
	return getAvatarFallbackHtml(fullClassName)
}
