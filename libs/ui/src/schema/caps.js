import { isNode } from '../kernel/node.js'
import { countNodes, walk } from '../kernel/walk.js'

/** Default safety caps for document trees. */
export const DEFAULT_CAPS = {
	maxDepth: 48,
	maxNodes: 2000,
	maxTextLength: 8000,
}

/**
 * @param {unknown} node
 * @returns {number}
 */
export function treeDepth(node) {
	if (!isNode(node)) return 0
	const n = /** @type {import('../kernel/node.js').Node} */ (node)
	let md = 1
	for (const ch of n.children || []) {
		md = Math.max(md, 1 + treeDepth(ch))
	}
	if (n.props) {
		for (const v of Object.values(n.props)) {
			if (isNode(v)) {
				md = Math.max(md, 1 + treeDepth(v))
			}
		}
	}
	return md
}

/**
 * @param {unknown} root
 * @param {{ maxDepth: number, maxNodes: number, maxTextLength: number }} caps
 */
export function checkCaps(root, caps) {
	/** @type {{ path: string, code: string, message: string }[]} */
	const errors = []
	const n = countNodes(root)
	if (n > caps.maxNodes) {
		errors.push({
			path: '',
			code: 'CAP_NODES',
			message: `Node count ${n} exceeds maxNodes ${caps.maxNodes}`,
		})
	}
	const d = treeDepth(root)
	if (d > caps.maxDepth) {
		errors.push({
			path: '',
			code: 'CAP_DEPTH',
			message: `Depth ${d} exceeds maxDepth ${caps.maxDepth}`,
		})
	}
	let textLen = 0
	walk(root, {
		enter(node) {
			if (!node || typeof node !== 'object') return
			const p = /** @type {{ props?: { value?: string }}} */ (node).props
			if (p && typeof p.value === 'string') {
				textLen += p.value.length
			}
		},
	})
	if (textLen > caps.maxTextLength) {
		errors.push({
			path: '',
			code: 'CAP_TEXT',
			message: `Total text length ${textLen} exceeds maxTextLength ${caps.maxTextLength}`,
		})
	}
	return errors
}
