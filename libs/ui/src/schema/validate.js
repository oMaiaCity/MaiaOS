import { isNode } from '../kernel/node.js'
import { walk } from '../kernel/walk.js'
import { checkCaps, DEFAULT_CAPS } from './caps.js'

const THEME_TYPES = new Set(['theme', 'token', 'group', 'color', 'font', 'space'])

/**
 * Validate a tree. Three phases:
 *   - `theme`     theme token tree (types in {theme,group,color,font,space}).
 *   - `doc`       pre-expand document (types must exist in `registry`; `$children` allowed).
 *   - `expanded`  post-expand document (types must exist and must not have a `template`).
 *
 * @param {unknown} root
 * @param {{
 *   phase: 'theme' | 'doc' | 'expanded'
 *   registry?: Record<string, { template?: unknown, measure?: unknown, layout?: unknown, paint?: unknown }>
 *   caps?: typeof DEFAULT_CAPS
 * }} opts
 * @returns {{ ok: boolean, errors: { path: string, code: string, message: string }[] }}
 */
export function validate(root, opts) {
	/** @type {{ path: string, code: string, message: string }[]} */
	const errors = []
	const caps = opts.caps ?? DEFAULT_CAPS

	if (!isNode(root)) {
		errors.push({ path: '', code: 'ROOT', message: 'Root must be a Node with type' })
		return { ok: false, errors }
	}

	if (opts.phase === 'theme') {
		walk(root, {
			enter(node, path) {
				if (!isNode(node)) return
				const n = /** @type {import('../kernel/node.js').Node} */ (node)
				if (!n.type) {
					errors.push({ path, code: 'TYPE', message: 'Node missing type' })
					return
				}
				if (!THEME_TYPES.has(n.type)) {
					errors.push({ path, code: 'THEME_TYPE', message: `Invalid theme node type: ${n.type}` })
				}
			},
		})
		for (const e of checkCaps(root, caps))
			errors.push({ path: e.path || '', code: e.code, message: e.message })
		return { ok: errors.length === 0, errors }
	}

	const reg = opts.registry ?? {}

	walk(root, {
		enter(node, path) {
			if (!isNode(node)) return
			const n = /** @type {import('../kernel/node.js').Node} */ (node)
			if (!n.type) {
				errors.push({ path, code: 'TYPE', message: 'Node missing type' })
				return
			}
			if (n.type === '$children') {
				if (opts.phase === 'expanded') {
					errors.push({ path, code: 'EXPAND', message: 'Unresolved $children slot' })
				}
				return
			}
			const def = reg[n.type]
			if (!def) {
				errors.push({ path, code: 'TYPE', message: `Unknown type: ${n.type}` })
				return
			}
			if (opts.phase === 'expanded' && def.template) {
				errors.push({
					path,
					code: 'EXPAND',
					message: `Unexpanded template composite: ${n.type}`,
				})
			}
		},
	})

	for (const e of checkCaps(root, caps))
		errors.push({ path: e.path || '', code: e.code, message: e.message })
	return { ok: errors.length === 0, errors }
}
