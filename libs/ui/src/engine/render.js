import { merge } from '../kernel/merge.js'
import { cloneNode } from '../kernel/node.js'
import { resolveRefs, resolveTokens } from '../kernel/refs.js'
import { registry as defaultRegistry } from '../registry.js'
import { validate } from '../schema/validate.js'
import { flattenTheme } from '../tokens/base.js'
import { expandTree } from './expand.js'
import { layoutTree } from './layout.js'
import { measureTree } from './measure.js'
import { paintTree } from './paint.js'

/**
 * Build one frame of the pipeline: overlays → validate → resolve $refs → expand
 * template composites → resolve $tokens → validate expanded → measure → layout.
 *
 * @param {unknown} doc
 * @param {import('../kernel/node.js').Node} themeTree
 * @param {unknown} variantOverlay
 * @param {number} viewportW
 * @param {CanvasRenderingContext2D} ctx
 * @param {Record<string, unknown>} [registryOverride]
 */
export function buildPipeline(doc, themeTree, variantOverlay, viewportW, ctx, registryOverride) {
	const reg = /** @type {Record<string, unknown>} */ (registryOverride ?? defaultRegistry)

	const theme = cloneNode(themeTree)
	const themeVal = validate(theme, { phase: 'theme' })
	if (!themeVal.ok) {
		throw new Error(`Theme invalid: ${JSON.stringify(themeVal.errors)}`)
	}

	let working = cloneNode(doc)
	if (variantOverlay != null) {
		working = /** @type {import('../kernel/node.js').Node} */ (merge(working, variantOverlay))
	}

	const docVal = validate(working, { phase: 'doc', registry: reg })
	if (!docVal.ok) {
		throw new Error(`Document invalid: ${JSON.stringify(docVal.errors)}`)
	}

	const flat = flattenTheme(theme)
	working = /** @type {import('../kernel/node.js').Node} */ (
		resolveRefs(working, {
			theme: /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (theme)),
		})
	)

	let expanded = /** @type {import('../kernel/node.js').Node} */ (expandTree(working, reg))
	expanded = /** @type {import('../kernel/node.js').Node} */ (resolveTokens(expanded, flat))

	const exVal = validate(expanded, { phase: 'expanded', registry: reg })
	if (!exVal.ok) {
		throw new Error(`Expanded tree invalid: ${JSON.stringify(exVal.errors)}`)
	}

	const { h } = measureTree(expanded, viewportW, ctx, reg)
	layoutTree(expanded, 0, 0, viewportW, reg)

	return { expanded, contentHeight: h, flat, registry: reg }
}

/**
 * @param {import('../kernel/node.js').Node} expanded
 * @param {number} viewportW
 * @param {number} contentHeight
 * @param {CanvasRenderingContext2D} ctx
 * @param {Record<string, string | number>} flat
 * @param {Record<string, unknown>} registry
 */
export function paintFrame(expanded, viewportW, contentHeight, ctx, flat, registry) {
	ctx.save()
	ctx.fillStyle = String(flat['colors.bg'] ?? '#000')
	ctx.fillRect(0, 0, viewportW, contentHeight)
	ctx.restore()
	paintTree(expanded, ctx, /** @type {Record<string, { paint?: Function }>} */ (registry))
}
