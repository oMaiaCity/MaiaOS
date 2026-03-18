/** True when eventDef sends contenteditable value (payload.value === '@contentEditableValue'). */
export function isContentEditableUpdateEvent(eventDef) {
	return eventDef?.payload?.value === '@contentEditableValue'
}

/** Convert camelCase to kebab-case. Shared by StyleEngine and ViewEngine. */
export function toKebabCase(str) {
	if (!str || typeof str !== 'string') return str
	const kebab = str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
	if (/^(webkit|moz|ms|o)-/.test(kebab)) return `-${kebab}`
	return kebab
}

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
