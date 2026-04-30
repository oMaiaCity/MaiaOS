/**
 * Universal Node shape — one model for every node in the tree.
 *
 * A Node is either a LEAF (draws something; no `children`) or a COMPOSITE
 * (composes one or more sub-nodes via `children`). Which role a node plays is
 * decided entirely by its `type` and what the registry provides for that type:
 *   - leaf              → registry entry has `measure` + `paint`
 *   - built-in composite → registry entry has `measure` + `layout` + `paint`
 *   - template composite → registry entry has `template` (+ optional `variants`)
 *
 * @typedef {{
 *   type: string
 *   props?: Record<string, unknown>
 *   children?: unknown[]
 *   $ref?: string
 *   $replace?: boolean
 * }} Node
 */

/**
 * @param {unknown} x
 * @returns {x is Node}
 */
export function isNode(x) {
	return x != null && typeof x === 'object' && typeof (/** @type {Node} */ (x).type) === 'string'
}

/**
 * @param {unknown} x
 */
export function isPropSubtree(x) {
	return isNode(x) || (x != null && typeof x === 'object' && '$prop' in /** @type {object} */ (x))
}

/**
 * @template T
 * @param {T} node
 * @returns {T}
 */
export function cloneNode(node) {
	if (node == null || typeof node !== 'object') return node
	if (Array.isArray(node)) return /** @type {T} */ (node.map((c) => cloneNode(c)))
	const out = { ...node }
	if (out.props && typeof out.props === 'object') {
		const p = {}
		for (const k of Object.keys(out.props)) {
			p[k] = cloneNode(/** @type {object} */ (out.props)[k])
		}
		out.props = p
	}
	if (Array.isArray(out.children)) {
		out.children = out.children.map((c) => cloneNode(c))
	}
	return /** @type {T} */ (out)
}
