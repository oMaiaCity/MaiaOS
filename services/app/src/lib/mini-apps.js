/**
 * @typedef {Object} MiniApp
 * @property {string} id - Unique identifier for the mini app
 * @property {string} name - Display name of the mini app
 * @property {string} description - Description of what the mini app does
 * @property {string} source - Path to the mini app HTML file (relative to static/)
 * @property {string} [url] - External URL (for future use)
 * @property {string} [icon] - SVG icon markup for the mini app
 */

/**
 * List of available mini apps
 * @type {MiniApp[]}
 */
export const miniApps = [
	{
		id: 'snake',
		name: 'Snake Game',
		description: 'Classic snake game - eat food and grow!',
		source: '/mini-apps/snake/index.html',
		icon: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8c0-2 2-4 4-4s4 2 4 4"/><path d="M16 16c0 2-2 4-4 4s-4-2-4-4"/><path d="M8 8c-2 0-4 2-4 4s2 4 4 4"/><path d="M16 16c2 0 4-2 4-4s-2-4-4-4"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>'
	}
];

/**
 * Get a mini app by its ID
 * @param {string} id - The mini app ID
 * @returns {MiniApp|undefined} The mini app if found, undefined otherwise
 */
export function getMiniAppById(id) {
	return miniApps.find((app) => app.id === id);
}

/**
 * Get all available mini apps
 * @returns {MiniApp[]} Array of all mini apps
 */
export function getAllMiniApps() {
	return miniApps;
}
