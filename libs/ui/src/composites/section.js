/**
 * `Section` — template composite. A full-width band that centers an inner
 * content stack (capped at `maxContentWidth`) and slots user children into it.
 *
 * @type {{ template: import('../kernel/node.js').Node, variants?: Record<string, Record<string, object>> }}
 */
export const section = {
	template: {
		type: 'stack',
		props: {
			fullWidth: true,
			align: 'center',
			gap: 0,
			bg: { $prop: 'bg' },
			padding: { y: { $prop: 'padY', default: 32 }, x: 0 },
			minH: { $prop: 'minH' },
			h: { $prop: 'h' },
		},
		children: [
			{
				type: 'stack',
				props: {
					maxWidth: { $prop: 'maxContentWidth', default: 1120 },
					align: { $prop: 'align', default: 'center' },
					justify: { $prop: 'justify', default: 'start' },
					gap: { $prop: 'gap', default: 24 },
					padding: { x: { $prop: 'padX', default: 32 }, y: 0 },
				},
				children: [{ type: '$children', children: [] }],
			},
		],
	},
}
