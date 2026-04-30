import { isNode } from '../kernel/node.js'

/**
 * Walk token theme: groups named `colors`, `fonts`, `space` with leaf props `{ name, value }`.
 * @param {import('../kernel/node.js').Node} themeRoot
 * @returns {Record<string, string | number>}
 */
export function flattenTheme(themeRoot) {
	/** @type {Record<string, string | number>} */
	const map = {}

	/**
	 * @param {string} prefix
	 * @param {unknown} node
	 */
	function visit(prefix, node) {
		if (!isNode(node)) return
		const n = /** @type {import('../kernel/node.js').Node} */ (node)
		if (n.type === 'group' && n.props && typeof n.props.name === 'string') {
			const name = n.props.name
			const path = prefix ? `${prefix}.${name}` : name
			for (const ch of n.children || []) {
				visit(path, ch)
			}
			return
		}
		if (n.props && typeof n.props.name === 'string' && 'value' in /** @type {object} */ (n.props)) {
			const key = `${prefix}.${n.props.name}`
			map[key] = /** @type {string | number} */ (n.props.value)
		}
	}

	for (const ch of themeRoot.children || []) {
		visit('', ch)
	}
	return map
}

/** Base design tokens as one theme Node tree. */
export const baseTheme = {
	type: 'theme',
	props: {},
	children: [
		{
			type: 'group',
			props: { name: 'colors' },
			children: [
				{ type: 'color', props: { name: 'bg', value: '#0F2428' } },
				{ type: 'color', props: { name: 'bgAlt', value: '#EEF2EC' } },
				{ type: 'color', props: { name: 'fg', value: '#FFFFFF' } },
				{ type: 'color', props: { name: 'muted', value: 'rgba(255, 255, 255, 0.65)' } },
				{ type: 'color', props: { name: 'accent', value: '#E8D547' } },
				{ type: 'color', props: { name: 'accentAlt', value: '#1B3A3F' } },
				{ type: 'color', props: { name: 'fgOnAccent', value: '#0F2428' } },
				{ type: 'color', props: { name: 'ghostBorder', value: 'rgba(255, 255, 255, 0.18)' } },
				{ type: 'color', props: { name: 'cardTint', value: '#FFFFFF' } },
				{ type: 'color', props: { name: 'cardFg', value: '#0F2428' } },
				{ type: 'color', props: { name: 'cardMuted', value: '#5A6A6C' } },
			],
		},
		{
			type: 'group',
			props: { name: 'fonts' },
			children: [
				{
					type: 'font',
					props: { name: 'display', value: '600 96px "Space Grotesk", Inter, sans-serif' },
				},
				{
					type: 'font',
					props: { name: 'title', value: '600 36px "Space Grotesk", Inter, sans-serif' },
				},
				{ type: 'font', props: { name: 'eyebrow', value: '500 13px Inter, sans-serif' } },
				{ type: 'font', props: { name: 'body', value: '400 18px Inter, sans-serif' } },
				{ type: 'font', props: { name: 'caption', value: '500 13px Inter, sans-serif' } },
				{ type: 'font', props: { name: 'button', value: '600 15px Inter, sans-serif' } },
				{ type: 'font', props: { name: 'nav', value: '500 14px Inter, sans-serif' } },
			],
		},
		{
			type: 'group',
			props: { name: 'space' },
			children: [
				{ type: 'space', props: { name: 'xs', value: 8 } },
				{ type: 'space', props: { name: 'sm', value: 12 } },
				{ type: 'space', props: { name: 'md', value: 20 } },
				{ type: 'space', props: { name: 'lg', value: 32 } },
				{ type: 'space', props: { name: 'xl', value: 48 } },
				{ type: 'space', props: { name: 'pill', value: 500 } },
			],
		},
	],
}
