import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'

/**
 * `text` — leaf. Draws one-or-more lines of typography.
 */

/**
 * @param {string} font
 */
function lineHeightFromFont(font) {
	const m = String(font).match(/(\d+(?:\.\d+)?)px/)
	if (m) return Math.round(Number(m[1]) * 1.28)
	return 22
}

/**
 * @param {string} s
 * @param {string} transform
 */
function applyTransform(s, transform) {
	if (transform === 'uppercase') return s.toUpperCase()
	if (transform === 'lowercase') return s.toLowerCase()
	return s
}

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {number} innerW
 * @param {CanvasRenderingContext2D} _ctx
 */
export function measure(node, innerW, _ctx) {
	const font = String(node.props.font ?? '16px sans-serif')
	const lineHeight = Number(node.props.lineHeight) || lineHeightFromFont(font)
	const transform = String(node.props.transform ?? 'none')
	const letterSpacing = Number(node.props.letterSpacing ?? 0)
	const raw = String(node.props.value ?? '')
	const value = applyTransform(raw, transform)
	const prepared = prepareWithSegments(value, font)
	const { lines } = layoutWithLines(prepared, innerW, lineHeight)

	const extraPerLine = letterSpacing > 0 ? letterSpacing : 0

	let maxLineW = 0
	for (const line of lines) {
		const padded =
			line.text.length > 1 ? line.width + (line.text.length - 1) * extraPerLine : line.width
		if (padded > maxLineW) maxLineW = padded
	}
	const w = Math.min(innerW, maxLineW)
	const h = lines.length * lineHeight
	node._textCache = {
		lines,
		lineHeight,
		font,
		color: String(node.props.color ?? '#000'),
		letterSpacing,
		extraPerLine,
	}
	return { w, h }
}

/**
 * @param {import('../kernel/node.js').Node} node
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @param {CanvasRenderingContext2D} ctx
 */
export function paint(node, box, ctx) {
	const c = node._textCache
	if (!c) return
	ctx.save()
	ctx.textBaseline = 'top'
	ctx.font = c.font
	ctx.fillStyle = c.color
	if (c.letterSpacing && 'letterSpacing' in ctx) {
		try {
			/** @type {any} */
			ctx.letterSpacing = `${c.letterSpacing}px`
		} catch {}
	}
	const align = String(node.props.align ?? 'start')
	let y = box.y
	for (const line of c.lines) {
		const padded =
			line.text.length > 1 ? line.width + (line.text.length - 1) * c.extraPerLine : line.width
		let x = box.x
		if (align === 'center') x = box.x + (box.w - padded) / 2
		if (align === 'end') x = box.x + box.w - padded
		ctx.fillText(line.text, x, y)
		y += c.lineHeight
	}
	ctx.restore()
}
