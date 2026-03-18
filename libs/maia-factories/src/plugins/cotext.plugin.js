/** CoText plugin: grapheme format for colist items */
import { countGraphemes } from 'unicode-segmenter/grapheme'

export const pluginId = '@factories/cotext'

function isSingleGrapheme(str) {
	if (typeof str !== 'string' || str.length === 0) return false
	return countGraphemes(str) === 1
}

export const formats = [
	{
		name: 'grapheme',
		definition: {
			type: 'string',
			validate: (str) => isSingleGrapheme(str),
		},
	},
]

// No schema-level keywords. CoText = colist + items.format grapheme (extends colist).
export const plugin = {
	formats,
}
