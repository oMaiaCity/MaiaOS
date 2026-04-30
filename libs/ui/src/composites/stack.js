import { isNode } from '../kernel/node.js'
import { normalizePadding, paintBackground } from './shared.js'

/**
 * `stack` — built-in composite. Vertical column.
 * Props:
 *   - `gap`                        number, space between children
 *   - `padding`                    number | { x, y }
 *   - `align: start|center|end`    horizontal placement of each child
 *   - `justify: start|center|end`  vertical placement of the whole content block
 *   - `w`, `h`, `minH`             explicit sizing
 *   - `fullWidth`                  take full parent width
 *   - `maxWidth`                   cap at this width (but <= parent)
 *   - `bg`, `radius`               background fill
 */

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {number} parentW
 */
function containerWidth(node, parentW) {
	const p = node.props ?? {}
	if (p.w != null) return Number(p.w)
	if (p.fullWidth) return parentW
	if (p.maxWidth != null) return Math.min(Number(p.maxWidth), parentW)
	return null
}

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {number} parentW
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ measure: Function }} reg
 */
export function measure(node, parentW, ctx, reg) {
	const pad = normalizePadding(node.props.padding)
	const gap = Number(node.props.gap ?? 0)

	const containerW = containerWidth(node, parentW)
	const innerW = (containerW != null ? containerW : parentW) - pad.x * 2

	/** @type {{ w: number, h: number }[]} */
	const dims = []
	let sumH = 0
	const kids = node.children || []
	for (let i = 0; i < kids.length; i++) {
		const ch = kids[i]
		if (!isNode(ch)) continue
		const m = reg.measure(ch, innerW, ctx)
		dims.push(m)
		if (i > 0) sumH += gap
		sumH += m.h
	}
	let maxChildW = 0
	for (const d of dims) {
		if (d.w > maxChildW) maxChildW = d.w
	}

	const totalW = containerW != null ? containerW : maxChildW + pad.x * 2
	const contentH = kids.length === 0 ? 0 : sumH
	const totalH =
		node.props.h != null
			? Number(node.props.h)
			: Math.max(Number(node.props.minH ?? 0), contentH + pad.y * 2)

	node._childDims = dims
	node._pad = pad
	node._gap = gap
	node._innerW = totalW - pad.x * 2
	node._contentH = contentH
	return { w: totalW, h: totalH }
}

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {{ layout: Function }} reg
 */
export function layout(node, reg) {
	const box = /** @type {{ x: number, y: number, w: number, h: number }} */ (node._box)
	const pad = /** @type {{ x: number, y: number }} */ (node._pad)
	const gap = /** @type {number} */ (node._gap)
	const innerW = box.w - pad.x * 2
	const dims = /** @type {{ w: number, h: number }[]} */ (node._childDims)
	const kids = /** @type {import('../kernel/node.js').Node[]} */ (node.children || [])
	const align = String(node.props.align ?? 'start')
	const justify = String(node.props.justify ?? 'start')

	let cy = box.y + pad.y
	const contentH = /** @type {number} */ (node._contentH)
	const innerH = box.h - pad.y * 2
	if (justify === 'center') cy = box.y + pad.y + (innerH - contentH) / 2
	if (justify === 'end') cy = box.y + box.h - pad.y - contentH

	for (let i = 0; i < kids.length; i++) {
		const ch = kids[i]
		if (!isNode(ch)) continue
		const d = dims[i]
		let cx = box.x + pad.x
		if (align === 'center') cx = box.x + pad.x + (innerW - d.w) / 2
		if (align === 'end') cx = box.x + pad.x + innerW - d.w
		reg.layout(ch, cx, cy, d.w)
		cy += d.h + gap
	}
}

export const paint = paintBackground
