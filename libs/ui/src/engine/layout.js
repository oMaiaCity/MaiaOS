import { isNode } from '../kernel/node.js'

/**
 * Assign absolute boxes. Leaves have no layout step. Built-in composites call
 * their own `layout` to place their children.
 *
 * @param {import('../kernel/node.js').Node} node
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {Record<string, { layout?: Function }>} registry
 * @param {{ layout: Function }} engineReg
 */
export function layoutNode(node, x, y, w, registry, engineReg) {
	const size = /** @type {{ w: number, h: number }} */ (node._size)
	node._box = { x, y, w, h: size.h }
	const def = registry[node.type]
	if (def && typeof def.layout === 'function') {
		def.layout(node, engineReg)
	}
}

/**
 * @param {unknown} root
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {Record<string, { layout?: Function }>} registry
 */
export function layoutTree(root, x, y, w, registry) {
	/** @type {{ layout: (n: import('../kernel/node.js').Node, x: number, y: number, w: number) => void }} */
	const engineReg = {
		layout: (n, lx, ly, lw) => layoutNode(n, lx, ly, lw, registry, engineReg),
	}
	if (!isNode(root)) return
	layoutNode(/** @type {import('../kernel/node.js').Node} */ (root), x, y, w, registry, engineReg)
}
