/**
 * `Heading` — template composite. Expands to a `text` leaf with heading typography.
 *
 * @type {{ template: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> }}
 */
export const heading = {
	template: {
		type: 'text',
		props: {
			value: { $prop: 'label' },
			font: { $token: 'fonts.title' },
			color: { $prop: 'color', default: { $token: 'colors.fg' } },
			align: { $prop: 'align', default: 'start' },
			lineHeight: { $prop: 'lineHeight' },
		},
	},
	variants: {
		variant: {
			display: {
				props: {
					font: { $token: 'fonts.display' },
					lineHeight: 96,
					letterSpacing: -2,
				},
			},
			title: { props: { font: { $token: 'fonts.title' }, lineHeight: 44 } },
			eyebrow: {
				props: {
					font: { $token: 'fonts.eyebrow' },
					color: { $prop: 'color', default: { $token: 'colors.muted' } },
					transform: 'uppercase',
					letterSpacing: 2.5,
				},
			},
		},
	},
}
