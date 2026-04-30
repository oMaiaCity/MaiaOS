import { cloneNode, isNode } from './node.js'

/**
 * Deep-merge overlay onto base. Overlay wins at leaves. `$replace: true` replaces entire subtree.
 * @param {unknown} base
 * @param {unknown} overlay
 * @returns {unknown}
 */
export function merge(base, overlay) {
	if (overlay == null) return cloneNode(base)
	if (base == null) return cloneNode(overlay)
	if (
		typeof overlay === 'object' &&
		overlay !== null &&
		'$replace' in overlay &&
		/** @type {{$replace?:boolean}} */ (overlay).$replace
	) {
		const { $replace: _r, ...rest } = /** @type {object & {$replace?: boolean}} */ (overlay)
		return cloneNode(rest)
	}
	if (!isNode(base) && !isNode(overlay)) {
		if (Array.isArray(base) && Array.isArray(overlay)) {
			const out = []
			const len = Math.max(base.length, overlay.length)
			for (let i = 0; i < len; i++) {
				if (i >= overlay.length) out.push(cloneNode(base[i]))
				else if (i >= base.length) out.push(cloneNode(overlay[i]))
				else out.push(merge(base[i], overlay[i]))
			}
			return out
		}
		return cloneNode(overlay)
	}
	if (!isNode(overlay)) {
		if (
			isNode(base) &&
			overlay &&
			typeof overlay === 'object' &&
			!Array.isArray(overlay) &&
			('$replace' in overlay ||
				'props' in /** @type {object} */ (overlay) ||
				'children' in /** @type {object} */ (overlay) ||
				'type' in /** @type {object} */ (overlay))
		) {
			const b = /** @type {import('./node.js').Node} */ (base)
			const o = /** @type {object} */ (overlay)
			return merge(b, {
				type: typeof o.type === 'string' ? o.type : b.type,
				props: o.props,
				children: o.children,
			})
		}
		if (!isNode(base)) return cloneNode(overlay)
		return cloneNode(base)
	}
	if (!isNode(base)) return cloneNode(overlay)

	const b = /** @type {import('./node.js').Node} */ (cloneNode(base))
	const o = /** @type {import('./node.js').Node} */ (overlay)

	if (o.type !== undefined) b.type = o.type
	if (o.$ref !== undefined) b.$ref = o.$ref

	if (o.props && typeof o.props === 'object') {
		b.props = b.props ?? {}
		for (const k of Object.keys(o.props)) {
			const bv = b.props[k]
			const ov = o.props[k]
			if (isNode(bv) && isNode(ov)) {
				b.props[k] = /** @type {import('./node.js').Node} */ (merge(bv, ov))
			} else if (
				bv != null &&
				ov != null &&
				typeof bv === 'object' &&
				typeof ov === 'object' &&
				!isNode(bv) &&
				!isNode(ov) &&
				!Array.isArray(bv) &&
				!('$prop' in /** @type {object} */ (bv))
			) {
				b.props[k] = /** @type {Record<string, unknown>} */ (merge(bv, ov))
			} else {
				b.props[k] = cloneNode(ov)
			}
		}
	}

	if (o.children != null) {
		const bc = Array.isArray(b.children) ? b.children : []
		const oc = Array.isArray(o.children) ? o.children : []
		b.children = /** @type {unknown[]} */ (merge(bc, oc))
	}

	return b
}
