import { isNode } from '../kernel/node.js'

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {number} parentW
 * @param {CanvasRenderingContext2D} ctx
 * @param {Record<string, { measure?: Function }>} registry
 * @param {{ measure: Function }} engineReg
 * @returns {{ w: number, h: number }}
 */
export function measureNode(node, parentW, ctx, registry, engineReg) {
	const def = registry[node.type]
	if (!def || typeof def.measure !== 'function') {
		throw new Error(`Unknown node type (no measure): ${node.type}`)
	}
	const r = def.measure(node, parentW, ctx, engineReg)
	node._size = r
	return r
}

/**
 * @param {unknown} root
 * @param {number} viewportW
 * @param {CanvasRenderingContext2D} ctx
 * @param {Record<string, { measure?: Function }>} registry
 */
export function measureTree(root, viewportW, ctx, registry) {
	/** @type {{ measure: (n: import('../kernel/node.js').Node, w: number, c: CanvasRenderingContext2D) => { w: number, h: number } }} */
	const engineReg = {
		measure: (n, w, c) => measureNode(n, w, c, registry, engineReg),
	}
	if (!isNode(root)) return { w: 0, h: 0 }
	return measureNode(
		/** @type {import('../kernel/node.js').Node} */ (root),
		viewportW,
		ctx,
		registry,
		engineReg,
	)
}
