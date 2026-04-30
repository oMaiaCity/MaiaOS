/**
 * `rect` — leaf. Solid rectangle with optional rounded corners.
 * (For grouping + background, use `stack` or `row` which support `bg` + `radius`.)
 */

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {number} parentW
 */
export function measure(node, parentW) {
	const w = node.props.w != null ? Number(node.props.w) : parentW
	const h = Number(node.props.h ?? 0)
	return { w, h }
}

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @param {CanvasRenderingContext2D} ctx
 */
export function paint(node, box, ctx) {
	const radius = Number(node.props.radius ?? 0)
	const color = node.props.color
	if (!color || typeof color !== 'string') return
	ctx.save()
	ctx.fillStyle = color
	if (radius > 0) {
		roundRect(ctx, box.x, box.y, box.w, box.h, radius)
		ctx.fill()
	} else {
		ctx.fillRect(box.x, box.y, box.w, box.h)
	}
	ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
	const rr = Math.min(r, w / 2, h / 2)
	ctx.beginPath()
	ctx.moveTo(x + rr, y)
	ctx.arcTo(x + w, y, x + w, y + h, rr)
	ctx.arcTo(x + w, y + h, x, y + h, rr)
	ctx.arcTo(x, y + h, x, y, rr)
	ctx.arcTo(x, y, x + w, y, rr)
	ctx.closePath()
}
