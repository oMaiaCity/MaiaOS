/**
 * The whole landing page as one composite tree.
 *
 * Root is a full-width `stack` that vertically stacks four `Section` composites.
 * No special `doc`/`component`/`primitive` distinction: every node is just a
 * Node with a `type` resolved against the registry.
 */
export const landingDoc = {
	type: 'stack',
	props: { fullWidth: true, gap: 0 },
	children: [
		{
			type: 'Section',
			props: {
				bg: { $token: 'colors.bg' },
				minH: 720,
				justify: 'center',
				gap: 40,
				maxContentWidth: 880,
			},
			children: [
				{
					type: 'Heading',
					props: { variant: 'eyebrow', label: 'THE FUTURE IS NOW', align: 'center' },
				},
				{
					type: 'Heading',
					props: { variant: 'display', label: '°Aven', align: 'center' },
				},
				{
					type: 'Paragraph',
					props: {
						label: 'Your personal Agent CEO for the new human-agent economy.',
						align: 'center',
					},
				},
				{
					type: 'row',
					props: { justify: 'center', align: 'center', gap: 20 },
					children: [
						{
							type: 'Button',
							props: { variant: 'primary', size: 'md', label: 'Get Started' },
						},
						{
							type: 'Button',
							props: { variant: 'secondary', size: 'md', label: 'Learn More' },
						},
					],
				},
			],
		},
		{
			type: 'Section',
			props: { bg: { $token: 'colors.bgAlt' }, padY: 128, gap: 56 },
			children: [
				{
					type: 'Heading',
					props: {
						variant: 'title',
						label: 'The Personal CEO Economy',
						align: 'center',
						color: { $token: 'colors.accentAlt' },
					},
				},
				{
					type: 'row',
					props: { columns: 'equal', gap: 28, align: 'start' },
					children: [
						{
							type: 'Card',
							props: { bg: { $token: 'colors.cardTint' } },
							children: [
								{
									type: 'Heading',
									props: {
										variant: 'title',
										label: 'Visionary',
										color: { $token: 'colors.cardFg' },
									},
								},
								{
									type: 'Paragraph',
									props: {
										label:
											'Humans as Chief Visionary Officers. You direct the creative work and strategic intent.',
										color: { $token: 'colors.cardMuted' },
									},
								},
							],
						},
						{
							type: 'Card',
							props: { bg: { $token: 'colors.accent' } },
							children: [
								{
									type: 'Heading',
									props: {
										variant: 'title',
										label: 'Executive',
										color: { $token: 'colors.bg' },
									},
								},
								{
									type: 'Paragraph',
									props: {
										label:
											'Avens as Chief Executive Officers. They execute the complexity and deliver the results.',
										color: { $token: 'colors.bg' },
									},
								},
							],
						},
					],
				},
			],
		},
		{
			type: 'Section',
			props: { bg: { $token: 'colors.bg' }, padY: 128, gap: 32, maxContentWidth: 720 },
			children: [
				{
					type: 'Heading',
					props: { variant: 'title', label: 'The Future of Work', align: 'center' },
				},
				{
					type: 'Paragraph',
					props: {
						label:
							'°Aven is the kernel for solo businesses. Powerful, organic, and built for the age of agents.',
						align: 'center',
					},
				},
				{
					type: 'Button',
					props: { variant: 'primary', size: 'md', label: 'Join the Revolution' },
				},
			],
		},
		{
			type: 'Section',
			props: { bg: { $token: 'colors.bg' }, padY: 56 },
			children: [
				{
					type: 'Paragraph',
					props: {
						tone: 'muted',
						label: '© 2026 °Aven. The future is now.',
						align: 'center',
					},
				},
			],
		},
	],
}
