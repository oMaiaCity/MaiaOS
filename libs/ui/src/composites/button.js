/**
 * `Button` — template composite. Expands to a `stack` composite with a pill
 * background containing a single centered `text` leaf.
 *
 * @type {{ template: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> }}
 */
export const button = {
	template: {
		type: 'stack',
		props: {
			bg: { $token: 'colors.accent' },
			radius: 999,
			padding: { x: 32, y: 14 },
			align: 'center',
			justify: 'center',
			gap: 0,
		},
		children: [
			{
				type: 'text',
				props: {
					value: { $prop: 'label' },
					font: { $token: 'fonts.button' },
					color: { $token: 'colors.fgOnAccent' },
					align: 'center',
				},
			},
		],
	},
	variants: {
		variant: {
			primary: {},
			secondary: {
				props: { bg: { $token: 'colors.accentAlt' } },
				children: [
					{
						type: 'text',
						props: { color: { $token: 'colors.fg' } },
					},
				],
			},
			ghost: {
				props: { bg: 'transparent' },
				children: [
					{
						type: 'text',
						props: { color: { $token: 'colors.fg' } },
					},
				],
			},
		},
		size: {
			md: {},
			sm: {
				props: { padding: { x: 18, y: 8 } },
				children: [
					{
						type: 'text',
						props: { font: { $token: 'fonts.caption' } },
					},
				],
			},
		},
	},
}
