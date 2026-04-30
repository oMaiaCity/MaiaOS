/**
 * `Card` — template composite. A padded rounded surface that slots user-provided
 * children via `$children`.
 *
 * @type {{ template: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> }}
 */
export const card = {
	template: {
		type: 'stack',
		props: {
			bg: { $prop: 'bg', default: { $token: 'colors.cardTint' } },
			radius: 24,
			padding: { $prop: 'padding', default: 32 },
			gap: { $prop: 'gap', default: 16 },
			align: { $prop: 'align', default: 'start' },
			fullWidth: true,
		},
		children: [{ type: '$children', children: [] }],
	},
}
