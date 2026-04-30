/**
 * `Paragraph` — template composite. Expands to a `text` leaf with body typography.
 *
 * @type {{ template: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> }}
 */
export const paragraph = {
	template: {
		type: 'text',
		props: {
			value: { $prop: 'label' },
			font: { $token: 'fonts.body' },
			color: { $prop: 'color', default: { $token: 'colors.muted' } },
			align: { $prop: 'align', default: 'start' },
			lineHeight: 28,
		},
	},
	variants: {
		tone: {
			default: {},
			muted: { props: { color: { $token: 'colors.muted' } } },
			strong: { props: { color: { $token: 'colors.fg' } } },
		},
	},
}
