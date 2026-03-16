import { toKebabCase } from './utils.js'

/**
 * Compile styles object to CSS property declarations.
 * @param {Object} styles - { prop: value } map
 * @param {Function} interpolateTokens - (value) => interpolated string
 * @param {number} [indent=2] - Spaces before each line
 * @returns {string} CSS property block
 */
export function compileCSSProperties(styles, interpolateTokens, indent = 2) {
	if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) return ''
	const pad = ' '.repeat(indent)
	return Object.entries(styles)
		.map(([prop, value]) => {
			const cssProp = toKebabCase(prop)
			const cssValue = interpolateTokens(value)
			return `${pad}${cssProp}: ${cssValue};`
		})
		.join('\n')
}
