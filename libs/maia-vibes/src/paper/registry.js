/**
 * Paper Vibe Registry
 * Standalone paper app (collaborative notes)
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import paperVibe from './manifest.vibe.maia'

export const PaperVibeRegistry = {
	vibe: paperVibe,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {},

	views: {},

	contexts: {},

	processes: {},

	data: {
		notes: [
			{ title: 'Dear future us', content: "**Dear future us**, what we're creating together..." },
			{
				title: 'Meeting notes',
				content: '## Meeting notes\n- Discussed *architecture*\n- Reviewed **sprint** goals',
			},
			{
				title: 'Ideas for the next sprint',
				content:
					'## Ideas for the next sprint\n1. Improve sync\n2. Add `format: "md"` support\n3. Ship it',
			},
			{
				title: 'Markdown Formatting',
				content: `# Markdown Formatting

## Headers
Use \`#\`, \`##\`, \`###\` for headings.

## Text
**Bold**, *italic*, ~~strikethrough~~, \`inline code\`.

## Lists
- Unordered item
- Another item

1. Ordered item
2. Second item

## Code
\`\`\`javascript
const x = 42;
\`\`\`

## Links
[MaiaOS](https://maia.city)

## Blockquote
> A quote for emphasis.`,
			},
		],
	},
}

export { PaperVibeRegistry as PaperAvenRegistry }
