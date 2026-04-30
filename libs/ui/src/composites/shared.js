/**
 * @param {unknown} p
 * @returns {{ x: number, y: number }}
 */
export function normalizePadding(p) {
	if (p == null) return { x: 0, y: 0 }
	if (typeof p === 'number') return { x: p, y: p }
	if (typeof p === 'object' && 'x' in /** @type {object} */ (p)) {
		const o = /** @type {{ x: number, y?: number }} */ (p)
		return { x: Number(o.x), y: Number(o.y ?? o.x) }
	}
	return { x: 0, y: 0 }
}

/**
 * Shared rounded-rect path helper for composites that draw a background.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
export function roundRect(ctx, x, y, w, h, r) {
	const rr = Math.min(r, w / 2, h / 2)
	ctx.beginPath()
	ctx.moveTo(x + rr, y)
	ctx.arcTo(x + w, y, x + w, y + h, rr)
	ctx.arcTo(x + w, y + h, x, y + h, rr)
	ctx.arcTo(x, y + h, x, y, rr)
	ctx.arcTo(x, y, x + w, y, rr)
	ctx.closePath()
}

/**
 * Paint a composite's own background (shared by stack/row).
 * @param {import('../kernel/node.js').Node} node
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @param {CanvasRenderingContext2D} ctx
 */
export function paintBackground(node, box, ctx) {
	const radius = Number(node.props.radius ?? 0)
	const bg = node.props.bg
	if (!bg || typeof bg !== 'string') return
	ctx.save()
	ctx.fillStyle = bg
	if (radius > 0) {
		roundRect(ctx, box.x, box.y, box.w, box.h, radius)
		ctx.fill()
	} else {
		ctx.fillRect(box.x, box.y, box.w, box.h)
	}
	ctx.restore()
}
