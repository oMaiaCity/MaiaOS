import { normalizePadding, paintBackground } from './shared.js'

/**
 * `row` — built-in composite. Horizontal row.
 * Props:
 *   - `columns: 'equal' | number[] | 'auto'`  default `'auto'`
 *   - `gap`, `padding`
 *   - `align: start|center|end`       vertical placement of each child
 *   - `justify: start|center|end`     horizontal placement of the whole content block
 *   - `w`, `h`                        explicit sizing (row fills parent width by default)
 *   - `bg`, `radius`                  background fill
 */

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {number} parentW
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ measure: (n: import('../kernel/node.js').Node, w: number, c: CanvasRenderingContext2D) => { w: number, h: number } }} reg
 */
export function measure(node, parentW, ctx, reg) {
	const pad = normalizePadding(node.props.padding)
	const gap = Number(node.props.gap ?? 0)
	const p = node.props ?? {}
	const columns = p.columns ?? 'auto'

	const containerW = p.w != null ? Number(p.w) : parentW
	const innerW = containerW - pad.x * 2

	const kids = /** @type {import('../kernel/node.js').Node[]} */ (node.children || [])
	const n = kids.length
	if (n === 0) {
		node._childDims = []
		node._pad = pad
		node._gap = gap
		node._colWidths = []
		node._contentW = 0
		return { w: containerW, h: node.props.h != null ? Number(node.props.h) : pad.y * 2 }
	}

	/** @type {number[]} */
	let colWidths
	let contentW = 0
	if (columns === 'equal') {
		const inner = innerW - gap * (n - 1)
		const cw = inner / n
		colWidths = Array(n).fill(cw)
		contentW = innerW
	} else if (Array.isArray(columns)) {
		const fr = /** @type {number[]} */ (columns)
		const sum = fr.reduce((a, b) => a + b, 0)
		const inner = innerW - gap * (n - 1)
		colWidths = fr.map((f) => (f / sum) * inner)
		contentW = innerW
	} else {
		colWidths = []
		let totalAutoW = 0
		for (let i = 0; i < n; i++) {
			const m = reg.measure(kids[i], innerW, ctx)
			colWidths.push(m.w)
			totalAutoW += m.w
		}
		contentW = totalAutoW + gap * (n - 1)
	}

	/** @type {{ w: number, h: number }[]} */
	const dims = []
	let maxH = 0
	for (let i = 0; i < n; i++) {
		const m = reg.measure(kids[i], colWidths[i], ctx)
		dims.push(m)
		if (m.h > maxH) maxH = m.h
	}

	node._childDims = dims
	node._pad = pad
	node._gap = gap
	node._colWidths = colWidths
	node._contentW = contentW
	const totalH = node.props.h != null ? Number(node.props.h) : maxH + pad.y * 2
	return { w: containerW, h: totalH }
}

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {{ layout: Function }} reg
 */
export function layout(node, reg) {
	const box = /** @type {{ x: number, y: number, w: number, h: number }} */ (node._box)
	const pad = /** @type {{ x: number, y: number }} */ (node._pad)
	const gap = /** @type {number} */ (node._gap)
	const colWidths = /** @type {number[]} */ (node._colWidths)
	const dims = /** @type {{ w: number, h: number }[]} */ (node._childDims)
	const kids = /** @type {import('../kernel/node.js').Node[]} */ (node.children || [])
	const vAlign = String(node.props.align ?? 'start')
	const justify = String(node.props.justify ?? 'start')

	let cx = box.x + pad.x
	const contentW = /** @type {number} */ (node._contentW)
	const innerW = box.w - pad.x * 2
	if (justify === 'center') cx = box.x + pad.x + (innerW - contentW) / 2
	if (justify === 'end') cx = box.x + box.w - pad.x - contentW

	for (let i = 0; i < kids.length; i++) {
		const ch = kids[i]
		if (ch == null || typeof ch !== 'object') continue
		const d = dims[i]
		let cy = box.y + pad.y
		if (vAlign === 'center') cy = box.y + pad.y + (box.h - pad.y * 2 - d.h) / 2
		if (vAlign === 'end') cy = box.y + box.h - pad.y - d.h
		reg.layout(ch, cx, cy, colWidths[i])
		cx += colWidths[i] + gap
	}
}

export const paint = paintBackground
