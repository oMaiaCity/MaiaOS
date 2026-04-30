import { merge } from '../kernel/merge.js'
import { cloneNode, isNode } from '../kernel/node.js'
import { stampChildren, stampProps } from '../kernel/refs.js'

/**
 * Expand template composites.
 *
 * For any node whose `type` resolves to a registry entry with a `template`,
 * replace the node with a stamped copy of the template (variants merged,
 * `$prop` bound, `$children` slots filled). Leaves and built-in composites
 * pass through unchanged. Template composites can nest: recursion repeats
 * until no template composites remain.
 */

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {{ template: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> }} def
 * @param {Record<string, unknown>} registry
 * @param {number} depth
 * @returns {unknown}
 */
function expandOne(node, def, registry, depth) {
	if (depth <= 0) {
		throw new Error(`expand depth exceeded at ${node.type}`)
	}
	let tree = /** @type {import('../kernel/node.js').Node} */ (cloneNode(def.template))
	const variants = def.variants ?? {}
	for (const [propName, byValue] of Object.entries(variants)) {
		const sel = node.props?.[propName]
		if (sel === undefined || byValue == null) continue
		const overlay = /** @type {unknown} */ (
			/** @type {Record<string, unknown>} */ (byValue)[String(sel)]
		)
		if (overlay != null) {
			tree = /** @type {import('../kernel/node.js').Node} */ (merge(tree, overlay))
		}
	}
	const propsBag = /** @type {Record<string, unknown>} */ (node.props ? { ...node.props } : {})
	tree = /** @type {import('../kernel/node.js').Node} */ (stampProps(tree, propsBag))
	tree = /** @type {import('../kernel/node.js').Node} */ (stampChildren(tree, node.children ?? []))
	return expandTree(tree, registry, depth - 1)
}

/**
 * @param {unknown} node
 * @param {Record<string, unknown>} registry
 * @param {number} [depth]
 * @returns {unknown}
 */
export function expandTree(node, registry, depth = 48) {
	if (!isNode(node)) return node
	const n = /** @type {import('../kernel/node.js').Node} */ (node)
	const def =
		/** @type {{ template?: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> } | undefined} */ (
			registry[n.type]
		)
	if (def?.template) {
		return expandOne(
			n,
			/** @type {{ template: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> }} */ (
				def
			),
			registry,
			depth,
		)
	}

	/** @type {Record<string, unknown>} */
	const nextProps = {}
	if (n.props && typeof n.props === 'object') {
		for (const k of Object.keys(n.props)) {
			const v = n.props[k]
			nextProps[k] = isNode(v) ? expandTree(v, registry, depth) : v
		}
	}
	const nextChildren = (n.children ?? []).map((ch) => expandTree(ch, registry, depth))
	return { ...n, props: nextProps, children: nextChildren }
}
