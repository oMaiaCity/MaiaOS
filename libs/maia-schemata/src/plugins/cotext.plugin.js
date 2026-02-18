/**
 * CoText validation plugin for MaiaOS schemata
 *
 * CoText = colist with grapheme-only items (plaintext CRDT).
 * Registers:
 * - format "grapheme": string must be exactly one Unicode grapheme cluster
 * - keyword "cotext": schema metadata (always passes); marks colist as CoText
 */

import { countGraphemes } from 'unicode-segmenter/grapheme'

export const pluginId = '@schemata/cotext'

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
