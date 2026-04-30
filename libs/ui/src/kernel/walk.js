import { isNode, isPropSubtree } from './node.js'

/**
 * Depth-first traverse; visits `children` and `props` values that are nodes or `$prop` holders.
 * @param {unknown} node
 * @param {{ enter?: (n: object, path: string) => void, leave?: (n: object, path: string) => void }} visitor
 * @param {string} [path]
 */
export function walk(node, visitor, path = '') {
	if (node == null || typeof node !== 'object') return
	if (!isNode(node) && !Array.isArray(node)) return

	if (isNode(node)) {
		visitor.enter?.(/** @type {object} */ (node), path)
		const n = /** @type {{ children?: unknown[], props?: Record<string, unknown> }} */ (node)
		if (Array.isArray(n.children)) {
			for (let i = 0; i < n.children.length; i++) {
				walk(n.children[i], visitor, `${path}/children/${i}`)
			}
		}
		if (n.props && typeof n.props === 'object') {
			for (const k of Object.keys(n.props)) {
				const v = n.props[k]
				if (isPropSubtree(v)) {
					walk(v, visitor, `${path}/props/${k}`)
				}
			}
		}
		visitor.leave?.(/** @type {object} */ (node), path)
	}
}

/**
 * Count nodes in tree (including nested props).
 * @param {unknown} root
 * @returns {number}
 */
export function countNodes(root) {
	let c = 0
	walk(root, {
		enter() {
			c++
		},
	})
	return c
}

/**
 * @param {unknown} root
 * @returns {number}
 */
export function maxDepth(root) {
	let d = 0
	walk(root, {
		enter(_n, p) {
			const depth = p.split('/').filter((s) => s === 'children' || s === 'props').length
			if (depth > d) d = depth
		},
	})
	return d + 1
}
