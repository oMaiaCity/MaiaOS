/**
 * Utility functions for Maia City
 */

export function truncate(str, maxLen = 40) {
	if (typeof str !== 'string') return str;
	if (str.length <= maxLen) return str;
	return str.substring(0, maxLen) + '...';
}
