import { merge } from './merge.js'
import { cloneNode, isNode } from './node.js'
import { walk } from './walk.js'

/**
 * @param {string} path
 * @param {Record<string, unknown>} registries
 * @returns {unknown}
 */
function lookupRef(path, registries) {
	const parts = path.split('.').filter(Boolean)
	let cur = /** @type {unknown} */ (registries)
	for (const p of parts) {
		if (cur == null || typeof cur !== 'object') return undefined
		cur = /** @type {Record<string, unknown>} */ (cur)[p]
	}
	return cur
}

/**
 * Resolve `$ref` recursively. Merges any extra fields from the placeholder onto the resolved node.
 * @param {unknown} tree
 * @param {Record<string, unknown>} registries
 * @param {Set<string>} [seen]
 * @returns {unknown}
 */
export function resolveRefs(tree, registries, seen = new Set()) {
	if (!isNode(tree)) return tree
	const node = /** @type {import('./node.js').Node} */ (cloneNode(tree))

	if (typeof node.$ref === 'string') {
		const ref = node.$ref
		if (seen.has(ref)) {
			throw new Error(`$ref cycle: ${ref}`)
		}
		seen.add(ref)
		const resolved = lookupRef(ref, registries)
		if (resolved == null) {
			throw new Error(`Unresolved $ref: ${ref}`)
		}
		const { $ref: _drop, ...rest } = node
		const inner = resolveRefs(cloneNode(resolved), registries, seen)
		seen.delete(ref)
		return merge(inner, Object.keys(rest).length ? rest : {})
	}

	if (node.props && typeof node.props === 'object') {
		const p = /** @type {Record<string, unknown>} */ ({})
		for (const k of Object.keys(node.props)) {
			const v = node.props[k]
			p[k] = isNode(v) ? resolveRefs(v, registries, seen) : v
		}
		node.props = p
	}

	if (Array.isArray(node.children)) {
		node.children = node.children.map((ch) => resolveRefs(ch, registries, seen))
	}

	return node
}

/**
 * @param {unknown} obj
 * @param {Record<string, string | number>} flatTokens
 */
function resolveTokensInProps(obj, flatTokens) {
	if (obj == null || typeof obj !== 'object') return
	if (isNode(obj)) return
	if (Array.isArray(obj)) {
		for (const el of obj) resolveTokensInProps(el, flatTokens)
		return
	}
	for (const k of Object.keys(obj)) {
		const v = /** @type {Record<string, unknown>} */ (obj)[k]
		if (
			v &&
			typeof v === 'object' &&
			!isNode(v) &&
			!Array.isArray(v) &&
			'$token' in v &&
			typeof (/** @type {{ $token: string }} */ (v).$token) === 'string'
		) {
			const key = /** @type {{ $token: string }} */ (v).$token
			const val = flatTokens[key]
			if (val === undefined) {
				throw new Error(`Unknown token: ${key}`)
			}
			/** @type {Record<string, unknown>} */
			obj[k] = val
		} else if (v && typeof v === 'object' && !isNode(v)) {
			resolveTokensInProps(v, flatTokens)
		}
	}
}

/**
 * Replace `{ $token: "colors.bg" }` leaves with concrete values from flat map (including nested props).
 * @param {unknown} tree
 * @param {Record<string, string | number>} flatTokens
 */
export function resolveTokens(tree, flatTokens) {
	const root = cloneNode(tree)

	walk(root, {
		enter(node) {
			if (!node || typeof node !== 'object' || !isNode(node)) return
			const n = /** @type {import('./node.js').Node & { props?: Record<string, unknown> }} */ (node)
			if (n.props) resolveTokensInProps(n.props, flatTokens)
		},
	})

	return root
}

/**
 * @param {unknown} obj
 * @param {Record<string, unknown>} propsBag
 */
function stampPropsInObject(obj, propsBag) {
	if (obj == null || typeof obj !== 'object') return
	if (isNode(obj)) return
	if (Array.isArray(obj)) {
		for (const el of obj) stampPropsInObject(el, propsBag)
		return
	}
	for (const k of Object.keys(obj)) {
		const v = /** @type {Record<string, unknown>} */ (obj)[k]
		if (
			v &&
			typeof v === 'object' &&
			!isNode(v) &&
			!Array.isArray(v) &&
			'$prop' in v &&
			typeof (/** @type {{ $prop: string }} */ (v).$prop) === 'string'
		) {
			const slot = /** @type {{ $prop: string, default?: unknown }} */ (v)
			const name = slot.$prop
			let resolved = propsBag[name]
			if (resolved === undefined && 'default' in slot) {
				resolved = slot.default
			}
			/** @type {Record<string, unknown>} */
			obj[k] = resolved
		} else if (v && typeof v === 'object' && !isNode(v)) {
			stampPropsInObject(v, propsBag)
		}
	}
}

/**
 * Bind `$prop: "name"` in props to values from props bag (including nested objects e.g. padding.y).
 * @param {unknown} tree
 * @param {Record<string, unknown>} props
 */
export function stampProps(tree, props) {
	const root = cloneNode(tree)
	const propsBag = props

	walk(root, {
		enter(node) {
			if (!node || typeof node !== 'object' || !isNode(node)) return
			const n = /** @type {import('./node.js').Node & { props?: Record<string, unknown> }} */ (node)
			if (n.props) stampPropsInObject(n.props, propsBag)
		},
	})

	return root
}

/**
 * Replace `$children` marker nodes with instance children.
 * @param {unknown} tree
 * @param {unknown[]} instanceChildren
 */
export function stampChildren(tree, instanceChildren) {
	const root = cloneNode(tree)
	replaceChildrenMarkers(root, instanceChildren)
	return root
}

/**
 * @param {unknown} node
 * @param {unknown[]} instanceChildren
 */
function replaceChildrenMarkers(node, instanceChildren) {
	if (!isNode(node)) return
	const n = /** @type {import('./node.js').Node} */ (node)
	if (!Array.isArray(n.children)) return
	const out = []
	for (const ch of n.children) {
		if (isNode(ch) && /** @type {import('./node.js').Node} */ (ch).type === '$children') {
			for (const ic of instanceChildren) {
				out.push(cloneNode(ic))
			}
		} else {
			out.push(ch)
			replaceChildrenMarkers(ch, instanceChildren)
		}
	}
	n.children = out
}
