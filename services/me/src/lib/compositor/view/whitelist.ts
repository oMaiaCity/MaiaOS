/**
 * Security Whitelist - Strict validation for untrusted JSON configs
 * Prevents XSS, script injection, and other security vulnerabilities
 */

import type { LeafNode } from './leaf-types'

/**
 * Validation result
 */
export interface ValidationResult {
	valid: boolean
	errors?: string[]
}

/**
 * Allowed HTML tags
 * Special tags: "icon" - renders Iconify icons
 */
const ALLOWED_TAGS = new Set([
	'div',
	'span',
	'button',
	'input',
	'form',
	'ul',
	'ol',
	'li',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'p',
	'label',
	'a',
	'svg',
	'path',
	'pre',
	'code',
	'section',
	'article',
	'header',
	'footer',
	'nav',
	'main',
	'aside',
	'img',
	'br',
	'hr',
	'icon', // Special tag for Iconify icons
])

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
	// Universal attributes (allowed on all tags)
	_universal: new Set([
		'class',
		'id',
		'role',
		'tabindex',
		'aria-label',
		'aria-labelledby',
		'aria-describedby',
		'aria-hidden',
		'aria-expanded',
		'aria-selected',
		'aria-checked',
		'aria-disabled',
		'aria-modal',
		'aria-live',
		'data-*', // Allow all data-* attributes
	]),

	div: new Set(['draggable']), // Allow draggable for drag and drop functionality
	button: new Set(['type', 'disabled', 'aria-label', 'title', 'form', 'formaction', 'formmethod']),
	input: new Set([
		'type',
		'name',
		'placeholder',
		'value',
		'disabled',
		'readonly',
		'required',
		'min',
		'max',
		'step',
		'pattern',
		'autocomplete',
		'aria-label',
		'aria-describedby',
	]),
	form: new Set(['action', 'method', 'enctype', 'novalidate']),
	a: new Set(['href', 'target', 'rel', 'download', 'aria-label']),
	img: new Set(['src', 'alt', 'width', 'height', 'loading', 'aria-label']),
	label: new Set(['for', 'aria-label']),
	svg: new Set([
		'fill',
		'viewbox', // SVG viewBox attribute (normalized to lowercase)
		'xmlns',
		'width',
		'height',
		'stroke',
		'stroke-width',
		'stroke-linecap',
		'stroke-linejoin',
		'class',
	]),
	path: new Set([
		'd',
		'fill',
		'stroke',
		'stroke-width',
		'stroke-linecap',
		'stroke-linejoin',
		'stroke-dasharray',
		'stroke-dashoffset',
		'class',
	]),
}

/**
 * Tailwind class patterns (regex)
 * Only allow safe Tailwind utilities
 */
const TAILWIND_PATTERNS = [
	// Spacing
	/^(p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr)-(\d+(\.\d+)?|auto)$/, // Allow fractional spacing like py-0.5, p-1.5, etc.
	/^gap-(\d+(\.\d+)?|auto)$/, // Allow fractional gap like gap-1.5, gap-2.5, etc.
	/^space-[xy]-(\d+(\.\d+)?|auto)$/, // Allow fractional space like space-x-1.5

	// Layout
	/^(flex|grid|block|inline|inline-block|inline-flex|hidden|contents)$/,
	/^@container$/, // Tailwind container query directive
	/^flex-(row|col|wrap|nowrap|grow|shrink|1|auto|none)$/, // flex-1, flex-auto, flex-none
	/^(shrink|grow)-(0|1)$/, // shrink-0, shrink-1, grow-0, grow-1
	/^min-w-0$/, // min-w-0 utility
	/^shrink-0$/, // shrink-0 utility (alternative to shrink-0)
	/^flex-(shrink|grow)-(\d+)$/, // flex-shrink-0, flex-shrink-1, flex-grow-0, flex-grow-1, etc.
	/^flex-grow$/, // flex-grow (standalone)
	/^flex-shrink$/, // flex-shrink (standalone)
	/^flex-basis-(\d+|auto|full|0)$/, // flex-basis-0, flex-basis-auto, etc.
	/^grid-cols-(\d+|auto|min|max|subgrid)$/,
	/^grid-rows-(\d+|auto|min|max|subgrid)$/,
	/^col-span-(\d+|auto|full)$/,
	/^row-span-(\d+|auto|full)$/,
	/^\[grid-column:.*\]$/, // [grid-column:...] for grid-column arbitrary value
	/^\[grid-row:.*\]$/, // [grid-row:...] for grid-row arbitrary value
	/^\[grid-area:.*\]$/, // [grid-area:...] for grid-area arbitrary value
	/^\[grid-template-areas:.*\]$/, // [grid-template-areas:...] for grid-template-areas arbitrary value
	/^\[grid-template-columns:.*\]$/, // [grid-template-columns:...] for grid-template-columns arbitrary value
	// Flexbox alignment
	/^items-(start|end|center|baseline|stretch)$/,
	/^justify-(start|end|center|between|around|evenly)$/,
	/^content-(start|end|center|between|around|evenly)$/,
	/^self-(start|end|center|baseline|stretch|auto)$/,

	// Sizing
	/^(w|h|min-w|min-h|max-w|max-h)-(full|screen|auto|\d+|px|rem|em|%|2xl|xl|lg|md|sm|xs)$/,
	/^(w|h|min-w|min-h|max-w|max-h)-(\d+)\/(\d+)$/,
	/^(mx|my|mt|mb|ml|mr)-(\d+|auto)$/, // Margin utilities like mx-4, mt-2
	/^(mx|my)-auto$/, // Margin auto like mx-auto

	// Colors
	/^(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d+)$/,
	/^(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)\/(\d+)$/, // Opacity modifiers like bg-red-100/50
	/^(bg|text|border)-(white|black|transparent|current|inherit)$/,
	/^(bg|text|border)-(alert|success|warning|info)$/, // Semantic color classes like text-alert, text-success
	/^(bg|text|border)-(white|black|transparent|current|inherit)\/(\d+)$/, // Opacity modifiers like bg-black/50
	/^(bg|text|border)-\[.*\]$/, // Arbitrary colors like bg-[#001a42], text-[#e6ecf7], border-[#001a42]
	/^border$/, // Standalone border
	/^border-none$/, // border-none utility
	/^border-(\d+|\[.*\])$/, // border-2, border-[...]
	/^border-(l|r|t|b)-(\d+|\[.*\])$/, // border-l-2, border-r-2, border-t-2, border-b-2
	/^border-(l|r|t|b)$/, // border-l, border-r, border-t, border-b (without number)
	// Gradients
	/^(bg|text|border)-(gradient|linear)-to-(r|l|t|b|tr|tl|br|bl)$/,
	/^(from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d+)$/,
	/^(from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)\/(\d+)$/, // Opacity modifiers like to-red-100/50
	/^(from|via|to)-(white|black|transparent|current)$/,

	// Typography
	/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
	/^text-\[.*\]$/, // Arbitrary text sizes like text-[10px], text-[#e6ecf7]
	/^text-(left|center|right|justify)$/, // Text alignment
	/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
	/^leading-(none|tight|snug|normal|relaxed|loose)$/,
	/^tracking-(tighter|tight|normal|wide|wider|widest)$/,
	/^(italic|not-italic|uppercase|lowercase|capitalize|normal-case)$/,
	/^(underline|line-through|no-underline)$/,
	/^truncate(-none)?$/, // truncate, truncate-none
	/^whitespace-(normal|nowrap|pre|pre-line|pre-wrap|break-spaces)$/, // whitespace utilities
	// Writing mode (vertical text)
	/^writing-(vertical-rl|vertical-lr|horizontal-tb)$/,
	/^\[text-orientation:.*\]$/, // Allow text-orientation arbitrary values
	// Text orientation (custom classes)
	/^text-(sideways|upright|mixed|sideways-right|glyph)$/,
	// Direction (custom classes)
	/^direction-(rtl|ltr)$/,

	// Effects
	/^shadow(-(sm|md|lg|xl|2xl|inner|none)|-button-primary|-button-primary-hover)$/,
	/^shadow-\[.*\]$/, // Allow arbitrary shadow values like shadow-[0_0_4px_rgba(0,0,0,0.02)]
	/^rounded(-(none|sm|md|lg|xl|2xl|3xl|full|\d+))?$/,
	/^rounded-\[.*\]$/, // Allow arbitrary rounded values
	/^opacity-(\d+|0)$/,
	/^bg-opacity-(\d+|0)$/, // bg-opacity-50, bg-opacity-75, etc.
	/^backdrop-blur(-(sm|md|lg|xl|2xl|3xl|none))?$/,

	// Transitions
	/^transition(-(all|colors|opacity|shadow|transform))?$/,
	/^duration-(\d+|75|100|150|200|300|500|700|1000)$/,
	/^ease-(linear|in|out|in-out)$/,

	// Positioning
	/^(static|fixed|absolute|relative|sticky)$/,
	/^(top|right|bottom|left|inset|inset-x|inset-y)-(\d+|auto|full|screen|0|1\/2|1\/3|2\/3|1\/4|3\/4)$/, // Support fractional values like top-1/2
	/^-(top|right|bottom|left)-(\d+|auto|full|screen|0|1\/2|1\/3|2\/3|1\/4|3\/4)$/, // Negative positioning with fractions: -left-1/2, -top-1/2, etc.
	/^z-(\d+|auto|0|9|10|20|30|40|50)$/, // Added z-9 support
	// Transform
	/^translate-[xy]-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/, // translate-x-1/2, translate-y-full
	/^-translate-[xy]-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/, // -translate-x-1/2, -translate-y-1/2
	/^translate-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/, // translate-1/2
	/^-translate-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/, // -translate-1/2
	// Cursor
	/^cursor-(pointer|not-allowed|wait|text|move|help|crosshair|default|grab|grabbing)$/,
	// Pointer events
	/^pointer-events-(none|auto)$/,
	// User Select
	/^select-(none|text|all|auto)$/,
	// Ring (focus rings)
	/^ring(-(\d+|offset-\d+(\.\d+)?))?$/, // Allow fractional ring offsets like ring-offset-0.5
	/^ring-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)$/,
	/^ring-\[.*\]$/, // Arbitrary ring colors like ring-[#001a42]
	/^ring-offset-(\d+(\.\d+)?)$/, // Allow fractional ring offsets like ring-offset-0.5
	/^ring-offset-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)$/,
	// Outline
	/^outline-(none|0|1|2|4|8)$/,
	// Scale (transform)
	/^scale-(\d+|\[.*\])$/,
	// Rotate (transform)
	/^rotate-(\d+|\[.*\])$/,
	/^-rotate-(\d+|\[.*\])$/,
	// Transform origin
	/^origin-(center|top|top-right|right|bottom-right|bottom|bottom-left|left|top-left)$/,

	// Display
	/^(inline|block|inline-block|flex|inline-flex|grid|inline-grid|table|inline-table|contents|list-item|hidden)$/,
	/^min-w-0$/, // min-w-0 utility
	/^shrink-0$/, // shrink-0 utility

	// Overflow
	/^overflow(-(x|y))?-(auto|hidden|clip|visible|scroll)$/,

	// Arbitrary values (safe patterns) - must be checked AFTER specific patterns
	/^(bg|text|border|shadow|rounded|w|h|min-w|min-h|max-w|max-h|p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|gap|space-[xy]|top|right|bottom|left|z|ring|scale)-\[.*\]$/, // Specific arbitrary value patterns with property prefix
	/^\[.*\]$/, // Allow standalone arbitrary values like [0_0_4px_rgba(0,0,0,0.02)]

	// Custom patterns (for specific use cases)
	/^hover:(.+)$/, // Allow hover: prefix
	/^active:(.+)$/, // Allow active: prefix
	/^focus:(.+)$/, // Allow focus: prefix
	/^disabled:(.+)$/, // Allow disabled: prefix
	/^placeholder:(.+)$/, // Allow placeholder: prefix
]

/**
 * Blocked patterns (security risks)
 */
const BLOCKED_PATTERNS = [
	/javascript:/i,
	/on\w+\s*=/i, // onclick=, onerror=, etc.
	/<script/i,
	/data:text\/html/i,
	/vbscript:/i,
	/expression\s*\(/i, // CSS expression()
]

/**
 * Container query prefixes (allowed)
 * These are Tailwind container query breakpoints: @3xs, @2xs, @xs, @sm, @md, @lg, @xl, @2xl, @3xl, @4xl, @5xl, @6xl, @7xl
 */
const CONTAINER_QUERY_PREFIXES = [
	'@3xs',
	'@2xs',
	'@xs',
	'@sm',
	'@md',
	'@lg',
	'@xl',
	'@2xl',
	'@3xl',
	'@4xl',
	'@5xl',
	'@6xl',
	'@7xl',
]

/**
 * Media query prefixes (blocked - we only use container queries)
 * These are Tailwind media query breakpoints: sm, md, lg, xl, 2xl, etc.
 */
const MEDIA_QUERY_PREFIXES = [
	'sm',
	'md',
	'lg',
	'xl',
	'2xl',
	'3xl',
	'4xl',
	'5xl',
	'6xl',
	'7xl',
	'min-sm',
	'min-md',
	'min-lg',
	'min-xl',
	'min-2xl',
	'max-sm',
	'max-md',
	'max-lg',
	'max-xl',
	'max-2xl',
]

/**
 * Check if a tag is allowed
 */
export function isAllowedTag(tag: string): boolean {
	return ALLOWED_TAGS.has(tag.toLowerCase())
}

/**
 * Check if an attribute is allowed for a tag
 */
export function isAllowedAttribute(tag: string, attr: string): boolean {
	const tagLower = tag.toLowerCase()
	const attrLower = attr.toLowerCase()

	// Check universal attributes
	if (ALLOWED_ATTRIBUTES._universal.has(attrLower)) {
		return true
	}

	// Check data-* attributes (universal)
	if (attrLower.startsWith('data-')) {
		return true
	}

	// Check aria-* attributes (universal)
	if (attrLower.startsWith('aria-')) {
		return true
	}

	// Check tag-specific attributes
	const tagAttrs = ALLOWED_ATTRIBUTES[tagLower]
	if (tagAttrs?.has(attrLower)) {
		return true
	}

	return false
}

/**
 * Sanitize attribute value
 */
export function sanitizeAttributeValue(tag: string, attr: string, value: unknown): string {
	const strValue = String(value)

	// Block dangerous patterns
	for (const pattern of BLOCKED_PATTERNS) {
		if (pattern.test(strValue)) {
			return ''
		}
	}

	// Special validation for href
	if (attr === 'href' && tag === 'a') {
		// Only allow http, https, mailto, tel, or relative paths
		if (!/^(https?:\/\/|mailto:|tel:|\/|#|\.)/.test(strValue)) {
			return '#'
		}
	}

	// Special validation for src (images)
	if (attr === 'src' && tag === 'img') {
		// Only allow http, https, or data:image
		if (!/^(https?:\/\/|data:image\/)/.test(strValue)) {
			return ''
		}
	}

	return strValue
}

/**
 * Sanitize Tailwind classes - returns both sanitized classes and blocked classes
 */
export function sanitizeClasses(classes: string[]): {
	sanitized: string[]
	blocked: string[]
} {
	const sanitized: string[] = []
	const blocked: string[] = []

	for (const cls of classes) {
		const trimmed = cls.trim()
		if (!trimmed) continue

		// Check if class matches any allowed pattern
		let allowed = false
		let remainingClass = trimmed
		let baseClass = trimmed
		let blockReason: string | null = null

		// Extract all prefixes and validate them
		// Handle nested prefixes like: @sm:hover:bg-blue-500
		let prefixValid = true
		while (remainingClass.includes(':')) {
			const colonIndex = remainingClass.indexOf(':')
			const prefix = remainingClass.substring(0, colonIndex)
			const rest = remainingClass.substring(colonIndex + 1)

			// Check if it's a container query prefix (@3xs, @2xs, @xs, @sm, etc.)
			if (prefix.startsWith('@')) {
				if (!CONTAINER_QUERY_PREFIXES.includes(prefix)) {
					// Unknown container query prefix - BLOCK IT (unless it's @container which is handled as base class)
					prefixValid = false
					blockReason = `Unknown container query prefix: ${prefix}`
					break
				}
				// Valid container query prefix, continue processing rest
				remainingClass = rest
				continue
			}

			// Check if it's a blocked media query prefix (sm, md, lg, etc.)
			if (MEDIA_QUERY_PREFIXES.includes(prefix)) {
				// Media query prefix detected - BLOCK IT
				prefixValid = false
				blockReason = `Media query prefix not allowed (use container queries instead): ${prefix}`
				break
			}

			// Check if it's an allowed pseudo-class prefix (hover, focus, etc.)
			if (['hover', 'focus', 'active', 'disabled', 'placeholder'].includes(prefix)) {
				// Valid pseudo-class prefix, continue processing rest
				remainingClass = rest
				continue
			}

			// Unknown prefix - might be part of the base class (like text-xs)
			// Stop extracting prefixes and treat remaining as base class
			break
		}

		// If we blocked it due to invalid prefix, skip
		if (!prefixValid) {
			blocked.push(trimmed + (blockReason ? ` (${blockReason})` : ''))
			continue
		}

		// Base class is what remains after extracting all prefixes
		baseClass = remainingClass

		// Check base class against patterns
		for (const pattern of TAILWIND_PATTERNS) {
			if (pattern.test(baseClass)) {
				allowed = true
				break
			}
		}

		// Also allow common utility classes that might not match patterns exactly
		// (like bg-linear-to-r which should be bg-gradient-to-r, but we'll be lenient)
		if (!allowed) {
			// Allow common patterns that are safe
			const safePatterns = [
				/^(bg|text|border)-(linear|gradient)-to-(r|l|t|b|tr|tl|br|bl)$/,
				/^(from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d+)$/,
			]
			for (const pattern of safePatterns) {
				if (pattern.test(baseClass)) {
					allowed = true
					break
				}
			}
		}

		if (allowed) {
			sanitized.push(trimmed)
		} else {
			blocked.push(trimmed + ` (no matching pattern for: ${baseClass})`)
		}
	}

	return { sanitized, blocked }
}

/**
 * Validate a leaf node recursively
 */
export function validateLeaf(node: LeafNode, path = 'root'): ValidationResult {
	const errors: string[] = []

	// If node has @schema, it will be resolved before validation
	// So we skip validation here - the resolved leaf will be validated instead
	if (node['@schema']) {
		return { valid: true }
	}

	// Validate tag (required for regular leaves)
	if (!node.tag || typeof node.tag !== 'string') {
		errors.push(`${path}: Missing or invalid tag`)
		return { valid: false, errors }
	}

	// Special handling for "icon" tag - it's a special tag for Iconify icons
	if (node.tag === 'icon') {
		// Validate icon configuration
		if (!node.icon || typeof node.icon !== 'object') {
			errors.push(`${path}: Icon tag must have an 'icon' configuration object`)
		} else {
			if (!node.icon.name || typeof node.icon.name !== 'string') {
				errors.push(`${path}: Icon configuration must have a 'name' string property`)
			}
			// Validate icon.classes (must be a string if provided)
			if (node.icon.classes !== undefined) {
				if (typeof node.icon.classes !== 'string') {
					errors.push(`${path}: Icon classes must be a string (space-separated)`)
				} else {
					// Split string by spaces and sanitize
					const iconClassArray = node.icon.classes.split(/\s+/).filter(Boolean)
					const { sanitized, blocked } = sanitizeClasses(iconClassArray)
					if (blocked.length > 0) {
						errors.push(`${path}: Some icon classes were blocked: ${blocked.join(', ')}`)
					}
				}
			}
		}
	} else if (!isAllowedTag(node.tag)) {
		errors.push(`${path}: Tag '${node.tag}' is not allowed`)
	}

	// Validate attributes
	if (node.attributes) {
		for (const [attr, value] of Object.entries(node.attributes)) {
			if (!isAllowedAttribute(node.tag, attr)) {
				errors.push(`${path}: Attribute '${attr}' is not allowed on tag '${node.tag}'`)
			} else {
				// Sanitize attribute value
				const sanitized = sanitizeAttributeValue(node.tag, attr, value)
				if (sanitized !== String(value)) {
					errors.push(`${path}: Attribute '${attr}' has unsafe value`)
				}
			}
		}
	}

	// Validate classes (must be a string, space-separated)
	if (node.classes) {
		if (typeof node.classes !== 'string') {
			errors.push(`${path}: Classes must be a string (space-separated)`)
		} else {
			// Split string by spaces and sanitize
			const classArray = node.classes.split(/\s+/).filter(Boolean)
			const { sanitized, blocked } = sanitizeClasses(classArray)
			if (blocked.length > 0) {
				errors.push(`${path}: Some classes were blocked: ${blocked.join(', ')}`)
			}
		}
	}

	// Validate bindings
	if (node.bindings) {
		if (node.bindings.foreach) {
			if (!node.bindings.foreach.items || typeof node.bindings.foreach.items !== 'string') {
				errors.push(`${path}: foreach.items must be a string data path`)
			}
			if (!node.bindings.foreach.leaf) {
				errors.push(`${path}: foreach.leaf is required`)
			} else {
				// Recursively validate nested leaf
				const nestedResult = validateLeaf(node.bindings.foreach.leaf, `${path}.foreach.leaf`)
				if (!nestedResult.valid) {
					errors.push(...(nestedResult.errors || []))
				}
			}
		}
	}

	// Validate events
	if (node.events) {
		for (const [eventName, eventConfig] of Object.entries(node.events)) {
			if (!eventConfig || typeof eventConfig !== 'object') {
				errors.push(`${path}: Event '${eventName}' must be an EventConfig object`)
				continue
			}

			if (!eventConfig.event || typeof eventConfig.event !== 'string') {
				errors.push(`${path}: Event '${eventName}' must have an 'event' string property`)
			}
		}
	}

	// Recursively validate elements (HTML nesting within leaf)
	if (node.elements) {
		node.elements.forEach((element, index) => {
			if (typeof element === 'object') {
				const elementResult = validateLeaf(element, `${path}.elements[${index}]`)
				if (!elementResult.valid) {
					errors.push(...(elementResult.errors || []))
				}
			}
			// String elements are always safe
		})
	}

	return {
		valid: errors.length === 0,
		errors: errors.length > 0 ? errors : undefined,
	}
}
