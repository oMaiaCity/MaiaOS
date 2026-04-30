import { isNode } from '../kernel/node.js'

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {CanvasRenderingContext2D} ctx
 * @param {Record<string, { paint?: Function }>} registry
 * @param {{ paint: Function }} engineReg
 */
export function paintNode(node, ctx, registry, engineReg) {
	const def = registry[node.type]
	if (!def) {
		throw new Error(`Unknown node type: ${node.type}`)
	}
	const box = /** @type {{ x: number, y: number, w: number, h: number }} */ (node._box)
	if (typeof def.paint === 'function') def.paint(node, box, ctx)

	if (!node.children?.length) return
	for (const ch of node.children) {
		if (isNode(ch)) engineReg.paint(ch, ctx)
	}
}

/**
 * @param {unknown} root
 * @param {CanvasRenderingContext2D} ctx
 * @param {Record<string, { paint?: Function }>} registry
 */
export function paintTree(root, ctx, registry) {
	if (!isNode(root)) return
	/** @type {{ paint: (n: import('../kernel/node.js').Node, c: CanvasRenderingContext2D) => void }} */
	const engineReg = {
		paint: (n, c) => paintNode(n, c, registry, engineReg),
	}
	paintNode(/** @type {import('../kernel/node.js').Node} */ (root), ctx, registry, engineReg)
}
