/**
 * Utility functions for Maia City
 */

export function truncate(str, maxLen = 40) {
	if (typeof str !== 'string') return str;
	if (str.length <= maxLen) return str;
	return str.substring(0, maxLen) + '...';
}

/**
 * Get sync status message based on status field
 * @param {Object} syncState - Sync state object with status field
 * @returns {string} Status message
 */
export function getSyncStatusMessage(syncState) {
	if (syncState.status === 'authenticating') {
		return 'Authenticating...';
	} else if (syncState.status === 'loading-account') {
		return 'Loading account...';
	} else if (syncState.status === 'syncing') {
		return 'Syncing';
	} else if (syncState.status === 'connected') {
		return 'Connected';
	} else if (syncState.status === 'error') {
		return syncState.error || 'Error';
	} else if (syncState.connected) {
		return syncState.syncing ? 'Syncing' : 'Connected';
	} else if (syncState.error) {
		return syncState.error;
	} else {
		return 'Offline';
	}
}
