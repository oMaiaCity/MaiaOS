/** SECURITY: Block prototype chain / constructor access (matches Evaluator) */
const FORBIDDEN_PATH_KEYS = ['__proto__', 'constructor', 'prototype']

function assertSafePath(path, context = 'style token path') {
	if (!path || typeof path !== 'string') return
	const lowerPath = path.toLowerCase()
	for (const key of FORBIDDEN_PATH_KEYS) {
		if (lowerPath.includes(key.toLowerCase())) {
			throw new Error(
				`[StyleEngine] Forbidden ${context}: path may not contain '${key}'. Got: ${path}`,
			)
		}
	}
}

function resolvePath(obj, path) {
	if (!obj || !path) return undefined
	assertSafePath(path, 'style token path')
	return path.split('.').reduce((acc, key) => {
		assertSafePath(key, 'style token segment')
		return acc?.[key]
	}, obj)
}

/** SECURITY: Block CSS injection via url(), expression(), -moz-binding, etc. */
const CSS_INJECTION_PATTERNS = [
	/javascript\s*:/i,
	/vbscript\s*:/i,
	/data\s*:\s*[^,]*base64\s*,/i,
	/expression\s*\(/i,
	/-moz-binding\s*:/i,
	/@import\b/i,
	/behavior\s*:/i,
]

function sanitizeCSSInterpolatedValue(value) {
	if (value == null || typeof value !== 'string') return value
	for (const pattern of CSS_INJECTION_PATTERNS) {
		if (pattern.test(value)) {
			return '' // Replace dangerous value with empty string
		}
	}
	return value
}

export class StyleEngine {
	constructor() {
		this.cache = new Map()
		this.dataEngine = null
	}

	resolveStyleRef(ref) {
		if (!ref || !ref.startsWith('co_z')) {
			throw new Error(
				`[StyleEngine] Style reference must be a co-id (starts with 'co_z'), got: ${ref}`,
			)
		}
		return ref
	}

	deepMerge(target, source) {
		const output = { ...target }
		for (const key in source) {
			if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
				output[key] = this.deepMerge(target[key], source[key])
			} else {
				output[key] = source[key]
			}
		}
		return output
	}

	_interpolateTokens(value, tokens) {
		if (typeof value !== 'string') return value
		return value.replace(/\{([^}]+)\}/g, (match, path) => {
			const tokenValue = resolvePath(tokens, path)
			if (tokenValue === undefined) return match
			// SECURITY: Sanitize interpolated values to prevent CSS injection (url(), expression(), etc.)
			return sanitizeCSSInterpolatedValue(String(tokenValue))
		})
	}

	_toKebabCase(str) {
		return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
	}

	/**
	 * Convert camelCase class selectors to kebab-case
	 * Preserves special selectors (:host, @container, @media, pseudo-selectors)
	 * @param {string} selector - CSS selector (e.g., ".todoCategory", ":host", ".buttonViewSwitch:hover")
	 * @returns {string} Converted selector (e.g., ".todo-category", ":host", ".button-view-switch:hover")
	 */
	_toKebabCaseSelector(selector) {
		if (!selector || typeof selector !== 'string') return selector

		// Preserve special selectors without conversion
		if (
			selector.startsWith(':host') ||
			selector.startsWith('@container') ||
			selector.startsWith('@media') ||
			selector.startsWith('@')
		) {
			return selector
		}

		// Handle class selectors (starting with .)
		// Split by spaces, combinators, and pseudo-selectors to handle complex selectors
		// Example: ".todoCategory:hover" or ".buttonViewSwitch.active"
		return selector.replace(/\.([a-zA-Z][a-zA-Z0-9]*)/g, (_match, className) => {
			// Convert camelCase class name to kebab-case
			const kebabClassName = className.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
			return `.${kebabClassName}`
		})
	}

	compileModifierStyles(styles, tokens) {
		if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) return ''
		return Object.entries(styles)
			.map(([prop, value]) => {
				const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
				const cssValue = this._interpolateTokens(value, tokens)
				return `  ${cssProp}: ${cssValue};`
			})
			.join('\n')
	}

	_flattenTokens(tokens, prefix = '') {
		const result = {}
		for (const [key, value] of Object.entries(tokens)) {
			const varName = prefix ? `${prefix}-${key}` : key
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				Object.assign(result, this._flattenTokens(value, varName))
			} else {
				result[`--${varName}`] = value
			}
		}
		return result
	}

	compileTokensToCSS(tokens, containerName = null) {
		const flatTokens = this._flattenTokens(tokens)
		const cssVars = Object.entries(flatTokens)
			.map(([name, value]) => `  ${name}: ${value};`)
			.join('\n')

		let fontFacesCSS = ''
		if (tokens.typography?.fontFaces && Array.isArray(tokens.typography.fontFaces)) {
			fontFacesCSS = `${tokens.typography.fontFaces
				.map((face) => {
					const props = Object.entries(face)
						.map(([prop, value]) => {
							const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
							return `  ${cssProp}: ${value};`
						})
						.join('\n')
					return `@font-face {\n${props}\n}`
				})
				.join('\n\n')}\n\n`
		}

		// Automatically enable container queries for all actors
		// Add container-type and container-name to :host selector
		let containerProps = ''
		if (containerName) {
			// Sanitize container name for CSS (replace special chars with hyphens)
			const sanitizedName = containerName.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-')
			containerProps = `  container-type: inline-size;\n  container-name: ${sanitizedName};\n`
		} else {
			// Still enable container-type even without name (unnamed container)
			containerProps = `  container-type: inline-size;\n`
		}

		return `${fontFacesCSS}:host {\n${containerProps}${cssVars}\n}\n`
	}

	_compileDataAttributeSelectors(baseSelector, dataTree, tokens, currentPath = '') {
		const cssRules = []
		if (!dataTree || typeof dataTree !== 'object' || Array.isArray(dataTree)) return cssRules

		for (const [dataKey, dataValue] of Object.entries(dataTree)) {
			if (typeof dataValue !== 'object' || dataValue === null || Array.isArray(dataValue)) continue

			const kebabDataKey = this._toKebabCase(dataKey)
			for (const [valueKey, styles] of Object.entries(dataValue)) {
				if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) continue

				const kebabValueKey = this._toKebabCase(valueKey)
				const dataAttr = `[data-${kebabDataKey}="${kebabValueKey}"]`
				const selector = `${baseSelector}${currentPath}${dataAttr}`

				const cssProps = {}
				const pseudoSelectors = {}
				let nestedData = null

				for (const [prop, propValue] of Object.entries(styles)) {
					if (prop === 'data') nestedData = propValue
					else if (prop.startsWith(':')) pseudoSelectors[prop] = propValue
					else cssProps[prop] = propValue
				}

				if (Object.keys(cssProps).length > 0) {
					cssRules.push(`${selector} {\n${this.compileModifierStyles(cssProps, tokens)}\n}`)
				}

				for (const [pseudo, pseudoStyles] of Object.entries(pseudoSelectors)) {
					cssRules.push(`${selector}${pseudo} {\n${this.compileModifierStyles(pseudoStyles, tokens)}\n}`)
				}

				if (nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)) {
					cssRules.push(
						...this._compileDataAttributeSelectors(
							baseSelector,
							nestedData,
							tokens,
							`${currentPath}${dataAttr}`,
						),
					)
				}
			}
		}
		return cssRules
	}

	compileComponentsToCSS(components, tokens) {
		if (!components || Object.keys(components).length === 0) return ''

		const cssRules = []
		for (const [className, styles] of Object.entries(components)) {
			const kebabClassName = className.replace(/([A-Z])/g, '-$1').toLowerCase()
			const dataTree = styles.data
			const stylesWithoutData = { ...styles }
			delete stylesWithoutData.data

			const baseStyles = {}
			const modifiers = {}

			for (const [prop, value] of Object.entries(stylesWithoutData)) {
				const isModifier =
					prop.startsWith(':') ||
					prop.startsWith('[') ||
					(typeof value === 'object' && value !== null && !Array.isArray(value))
				if (isModifier) modifiers[prop] = value
				else baseStyles[prop] = value
			}

			if (Object.keys(baseStyles).length > 0) {
				const cssProperties = Object.entries(baseStyles)
					.map(([prop, value]) => {
						const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
						return `  ${cssProp}: ${this._interpolateTokens(value, tokens)};`
					})
					.join('\n')
				const compiledRule = `.${kebabClassName} {\n${cssProperties}\n}`
				cssRules.push(compiledRule)
			}

			for (const [modifier, modifierStyles] of Object.entries(modifiers)) {
				let selector
				if (modifier.startsWith(':')) selector = `.${kebabClassName}${modifier}`
				else if (modifier.startsWith('[')) selector = `.${kebabClassName}${modifier}`
				else if (modifier.includes(' ')) selector = `.${kebabClassName} ${modifier}`
				else selector = `.${kebabClassName}[${modifier}]`

				cssRules.push(`${selector} {\n${this.compileModifierStyles(modifierStyles, tokens)}\n}`)
			}

			if (dataTree && typeof dataTree === 'object' && !Array.isArray(dataTree)) {
				cssRules.push(...this._compileDataAttributeSelectors(`.${kebabClassName}`, dataTree, tokens))
			}
		}
		return cssRules.join('\n\n')
	}

	compileSelectors(selectors, tokens) {
		if (!selectors || Object.keys(selectors).length === 0) return ''
		const cssRules = []
		for (const [selector, styles] of Object.entries(selectors)) {
			// Interpolate tokens in the selector itself (for container query breakpoints)
			const interpolatedSelector = this._interpolateTokens(selector, tokens)

			// Check if this is a container query, media query, or keyframes (starts with @)
			const isAtRule =
				interpolatedSelector.startsWith('@container') || interpolatedSelector.startsWith('@media')
			const isKeyframes = interpolatedSelector.startsWith('@keyframes')

			if (isKeyframes) {
				// @keyframes: styles = { "0%": { "transform": "..." }, "30%": { "transform": "..." } }
				// All values flow through compileModifierStyles → _interpolateTokens → sanitization
				const keyframeSteps = []
				for (const [stepSelector, stepStyles] of Object.entries(styles)) {
					if (typeof stepStyles === 'object' && stepStyles !== null && !Array.isArray(stepStyles)) {
						const cssProps = this.compileModifierStyles(stepStyles, tokens)
						keyframeSteps.push(`  ${stepSelector} {\n${cssProps}\n  }`)
					}
				}
				if (keyframeSteps.length > 0) {
					cssRules.push(`${interpolatedSelector} {\n${keyframeSteps.join('\n')}\n}`)
				}
			} else if (isAtRule) {
				// For container/media queries, styles contains nested selectors (e.g., ".stack", ".form")
				const nestedRules = []
				for (const [nestedSelector, nestedStyles] of Object.entries(styles)) {
					if (
						typeof nestedStyles === 'object' &&
						nestedStyles !== null &&
						!Array.isArray(nestedStyles)
					) {
						// Check if this is another at-rule (nested container/media query)
						const isNestedAtRule =
							nestedSelector.startsWith('@container') || nestedSelector.startsWith('@media')

						if (isNestedAtRule) {
							// Interpolate tokens in nested at-rule selector
							const interpolatedNestedSelector = this._interpolateTokens(nestedSelector, tokens)
							// Recursively compile nested at-rules
							const nestedAtRuleCSS = this.compileSelectors(
								{ [interpolatedNestedSelector]: nestedStyles },
								tokens,
							)
							nestedRules.push(
								nestedAtRuleCSS
									.split('\n')
									.map((line) => `  ${line}`)
									.join('\n'),
							)
						} else {
							// Regular nested selector with CSS properties
							// Convert camelCase class selectors to kebab-case to match DOM class names
							const kebabNestedSelector = this._toKebabCaseSelector(nestedSelector)
							const cssProperties = Object.entries(nestedStyles)
								.map(([prop, value]) => {
									const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
									return `    ${cssProp}: ${this._interpolateTokens(value, tokens)};`
								})
								.join('\n')
							nestedRules.push(`  ${kebabNestedSelector} {\n${cssProperties}\n  }`)
						}
					}
				}
				cssRules.push(`${interpolatedSelector} {\n${nestedRules.join('\n')}\n}`)
			} else {
				// Regular selector with CSS properties
				// Convert camelCase class selectors to kebab-case to match DOM class names
				const kebabSelector = this._toKebabCaseSelector(interpolatedSelector)
				const cssProperties = Object.entries(styles)
					.map(([prop, value]) => {
						const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
						return `  ${cssProp}: ${this._interpolateTokens(value, tokens)};`
					})
					.join('\n')
				cssRules.push(`${kebabSelector} {\n${cssProperties}\n}`)
			}
		}
		return cssRules.join('\n\n')
	}

	compileToCSS(tokens, components, selectors = {}, containerName = null) {
		let css = `${this.compileTokensToCSS(tokens, containerName)}\n${this.compileComponentsToCSS(components, tokens)}`
		const selectorCSS = this.compileSelectors(selectors, tokens)
		if (selectorCSS) css += `\n\n/* State-based selectors */\n${selectorCSS}`

		return css
	}

	async getStyleSheets(actorConfig, actorId = null) {
		const brandCoId = actorConfig.brand
		const styleCoId = actorConfig.style

		if (!brandCoId) {
			throw new Error(
				`[StyleEngine] Actor config must have 'brand' property with co-id. Config keys: ${Object.keys(actorConfig).join(', ')}. Config: ${JSON.stringify(actorConfig, null, 2)}`,
			)
		}

		// Extract actor ID from config if not provided
		const finalActorId = actorId || actorConfig.$id || actorConfig.id || 'actor'

		const cacheKey = `${brandCoId}_${styleCoId || 'none'}_${finalActorId}`
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)
		}

		const brandResolved = this.resolveStyleRef(brandCoId)
		const brandSchemaCoId = await this.dataEngine.peer.resolve(
			{ fromCoValue: brandResolved },
			{ returnType: 'coId' },
		)
		const brandStore = await this.dataEngine.execute({
			op: 'read',
			schema: brandSchemaCoId,
			key: brandResolved,
		})
		const brand = brandStore.value

		let actor = { tokens: {}, components: {} }
		if (styleCoId) {
			const styleResolved = this.resolveStyleRef(styleCoId)
			const styleSchemaCoId = await this.dataEngine.peer.resolve(
				{ fromCoValue: styleResolved },
				{ returnType: 'coId' },
			)
			const styleStore = await this.dataEngine.execute({
				op: 'read',
				schema: styleSchemaCoId,
				key: styleResolved,
			})
			actor = styleStore.value
		}

		// Generate container name from actor ID (sanitized for CSS)
		const containerName = finalActorId.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-')

		// Inject default container breakpoint tokens if missing (fully generic - available to ALL actors)
		// Also inject the container name as a token so it can be referenced in queries
		const defaultContainerTokens = {
			containers: {
				xs: '240px',
				sm: '360px',
				md: '480px',
				lg: '640px',
				xl: '768px',
				'2xl': '1024px',
			},
			containerName: containerName, // Inject container name so queries can reference root :host container
		}

		// Merge: default containers -> brand tokens -> actor tokens (actor can override)
		const brandTokensWithDefaults = this.deepMerge(defaultContainerTokens, brand.tokens || {})
		const mergedTokens = this.deepMerge(brandTokensWithDefaults, actor.tokens || {})
		const mergedComponents = this.deepMerge(brand.components || {}, actor.components || {})
		const mergedSelectors = this.deepMerge(brand.selectors || {}, actor.selectors || {})

		const css = this.compileToCSS(mergedTokens, mergedComponents, mergedSelectors, containerName)
		const sheet = new CSSStyleSheet()
		sheet.replaceSync(css)

		const sheets = [sheet]
		this.cache.set(cacheKey, sheets)
		return sheets
	}

	clearCache() {
		this.cache.clear()
	}
}
