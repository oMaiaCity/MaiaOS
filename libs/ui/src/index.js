import { buildPipeline, paintFrame } from './engine/render.js'
import { merge } from './kernel/merge.js'
import { cloneNode } from './kernel/node.js'
import { baseTheme } from './tokens/base.js'

/**
 * Sync canvas backing store to CSS size × devicePixelRatio.
 * @param {HTMLCanvasElement} canvas
 * @param {number} cssW
 * @param {number} cssH
 * @returns {number} scale factor applied (DPR clamped)
 */
export function syncCanvasSize(canvas, cssW, cssH) {
	const dpr = Math.min(globalThis.devicePixelRatio ?? 1, 2)
	canvas.width = Math.floor(cssW * dpr)
	canvas.height = Math.floor(cssH * dpr)
	canvas.style.width = `${cssW}px`
	canvas.style.height = `${cssH}px`
	return dpr
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('./kernel/node.js').Node} doc
 * @param {{ theme?: import('./kernel/node.js').Node, variant?: unknown, breakpoint?: unknown, registry?: Record<string, unknown> } | undefined} [overlays]
 * @returns {{ redraw: () => void, destroy: () => void }}
 */
export function mountDocument(canvas, doc, overlays) {
	const opts = overlays ?? {}
	const ctx = canvas.getContext('2d')
	if (!ctx) {
		throw new Error('2d context unavailable')
	}

	const theme = opts.theme ? merge(cloneNode(baseTheme), opts.theme) : cloneNode(baseTheme)
	const variantOverlay = opts.variant ?? opts.breakpoint ?? null

	const cssWidth = () => {
		const r = canvas.getBoundingClientRect()
		const fromRect = Number.isFinite(r.width) ? r.width : 0
		return Math.round(
			canvas.clientWidth ||
				fromRect ||
				globalThis.innerWidth ||
				globalThis.document?.documentElement?.clientWidth ||
				0,
		)
	}

	let zeroWRetries = 0

	const redraw = () => {
		const w = cssWidth()
		if (w <= 0) {
			if (zeroWRetries < 120) {
				zeroWRetries += 1
				requestAnimationFrame(redraw)
			}
			return
		}
		zeroWRetries = 0
		const { expanded, contentHeight, flat, registry } = buildPipeline(
			doc,
			theme,
			variantOverlay,
			w,
			ctx,
			opts.registry,
		)
		const cssH = Math.max(globalThis.innerHeight, contentHeight)
		const dpr = syncCanvasSize(canvas, w, cssH)
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		paintFrame(expanded, w, contentHeight, ctx, flat, registry)
	}

	const onResize = () => {
		redraw()
	}

	globalThis.addEventListener('resize', onResize)
	let ro
	if (typeof ResizeObserver !== 'undefined') {
		ro = new ResizeObserver(() => {
			redraw()
		})
		ro.observe(canvas)
	}

	requestAnimationFrame(redraw)

	return {
		redraw,
		destroy() {
			globalThis.removeEventListener('resize', onResize)
			ro?.disconnect()
		},
	}
}

export { isComposite, isLeaf, isTemplate, registry } from './registry.js'
export { baseTheme } from './tokens/base.js'
