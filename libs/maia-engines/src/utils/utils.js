// getContextValue removed - Backend unified store provides merged value directly via context.value
// getFactoryCoIdSafe removed - replaced with universal resolver resolve() from @MaiaOS/db/cojson/factory/resolver.js

/** True when eventDef sends contenteditable value (payload.value === '@contentEditableValue'). Used for debounce, blur, validation. */
export function isContentEditableUpdateEvent(eventDef) {
	return eventDef?.payload?.value === '@contentEditableValue'
}

/** Check if any contenteditable element has focus (traverses shadow DOM boundaries) */
export function isContentEditableActive() {
	let el = document.activeElement
	while (el?.shadowRoot?.activeElement) {
		el = el.shadowRoot.activeElement
	}
	return !!el?.isContentEditable
}

/** Convert camelCase to kebab-case. Shared by StyleEngine and ViewEngine. */
export function toKebabCase(str) {
	if (!str || typeof str !== 'string') return str
	const kebab = str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
	if (/^(webkit|moz|ms|o)-/.test(kebab)) return `-${kebab}`
	return kebab
}

/** Check if element is inside root (traverses shadow boundaries; contains() may not in all browsers) */
export function isInsideRoot(element, root) {
	if (!element || !root) return false
	let node = element
	while (node) {
		const r = node.getRootNode?.()
		if (r === root) return true
		if (r === document) return false
		node = r?.host
	}
	return false
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
