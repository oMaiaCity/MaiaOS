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
	if (syncState.status === 'connected') return 'Connected'
	if (syncState.status === 'error') return syncState.error || 'Error'
	if (syncState.connected) return syncState.syncing ? 'Syncing' : 'Connected'
	if (syncState.error) return syncState.error
	return defaultMsg
}
