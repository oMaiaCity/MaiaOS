/**
 * View definition validator - enforces dumb-view architecture.
 * Views may only use simple context/item references. Conditional logic ($if, $eq, ternary)
 * must live in state machines; context holds results, view renders.
 */

const CONDITIONAL_OPS = [
	'$if',
	'$eq',
	'$ne',
	'$and',
	'$or',
	'$not',
	'$switch',
	'$gt',
	'$lt',
	'$gte',
	'$lte',
]

function isDSLOperation(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false
	const keys = Object.keys(value)
	if (keys.length === 0) return false
	const firstKey = keys[0]
	if (!firstKey.startsWith('$')) return false
	return CONDITIONAL_OPS.includes(firstKey)
}

function hasTernary(value) {
	return typeof value === 'string' && value.includes('?') && value.includes(':')
}

function rejectValue(value, path, propName) {
	if (typeof value === 'object' && isDSLOperation(value)) {
		const opName = Object.keys(value)[0]
		throw new Error(
			`[ViewEngine] Conditional logic (${opName}) not allowed in ${path}.${propName}. Use state machines.`,
		)
	}
	if (hasTernary(value)) {
		throw new Error(
			`[ViewEngine] Ternary operators not allowed in ${path}.${propName}. Use state machines.`,
		)
	}
}

function rejectDataSpec(value, path) {
	if (typeof value === 'string') {
		if (hasTernary(value)) {
			throw new Error(`[ViewEngine] Conditional logic not allowed in data attributes. Found: ${value}`)
		}
		return
	}
	if (typeof value === 'object' && value !== null) {
		if (isDSLOperation(value)) {
			throw new Error(
				`[ViewEngine] Conditional logic (${Object.keys(value)[0]}) not allowed in data attributes.`,
			)
		}
		for (const [k, v] of Object.entries(value)) {
			rejectValue(v, `${path}.data.${k}`, k)
		}
	}
}

function validateViewNode(node, path = 'view') {
	if (!node || typeof node !== 'object') return
	if (Array.isArray(node)) {
		for (let i = 0; i < node.length; i++) {
			validateViewNode(node[i], `${path}[${i}]`)
		}
		return
	}

	// Reject conditional logic in scalar view properties
	if (node.class !== undefined) rejectValue(node.class, path, 'class')
	if (node.value !== undefined) rejectValue(node.value, path, 'value')
	if (node.text !== undefined) rejectValue(node.text, path, 'text')

	if (node.attrs) {
		for (const [attrName, attrValue] of Object.entries(node.attrs)) {
			if (attrName === 'data') {
				rejectDataSpec(attrValue, path)
			} else {
				rejectValue(attrValue, `${path}.attrs.${attrName}`, attrName)
			}
		}
	}

	if (node.children) {
		for (let i = 0; i < node.children.length; i++) {
			const child = node.children[i]
			if (child && typeof child === 'object' && isDSLOperation(child)) {
				throw new Error(
					`[ViewEngine] Conditional logic (${Object.keys(child)[0]}) not allowed in view templates. Use state machines.`,
				)
			}
			validateViewNode(child, `${path}.children[${i}]`)
		}
	}

	if (node.$each) {
		validateViewNode(node.$each.template, `${path}.$each.template`)
	}
}

/**
 * Validate a view definition. Throws if conditional logic is found.
 * Call at load time (loadViewConfigs) so render path has zero checks.
 */
export function validateViewDef(viewDef) {
	const node = viewDef?.content ?? viewDef
	if (!node) return
	validateViewNode(node, 'view')
}
