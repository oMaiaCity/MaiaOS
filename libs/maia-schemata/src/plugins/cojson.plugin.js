/**
 * CoJSON validation plugin for MaiaOS schemata
 *
 * Registers AJV keywords:
 * - $co: Co-id reference macro
 * - cotype: CRDT type (comap, colist, costream) at schema root
 * - indexing: Metadata for schema indexing (always passes)
 */

export const pluginId = '@schemata/cojson'

export const keywords = [
	{
		keyword: '$co',
		macro: (schemaCoId) => ({
			type: 'string',
			pattern: '^co_z[a-zA-Z0-9]+$',
			_schemaRef: schemaCoId,
		}),
		metaSchema: {
			type: 'string',
			anyOf: [
				{
					pattern: '^co_z[a-zA-Z0-9]+$',
					description: 'Co-id reference (after transformation)',
				},
				{
					pattern: '^@[a-zA-Z0-9_-]+/schema/',
					description: 'Human-readable schema ID with @ prefix (e.g. @domain/schema/...)',
				},
				{
					pattern: '^°[a-zA-Z0-9_-]+/schema/',
					description: 'Human-readable schema ID with ° prefix (e.g. °Maia/schema/...)',
				},
			],
			description:
				'Reference to schema that this property value must conform to (human-readable ID or co-id)',
		},
	},
	{
		keyword: 'cotype',
		validate: (schema, data) => {
			if (data === null || typeof data !== 'object') {
				return true
			}
			if (schema === 'comap') {
				return !Array.isArray(data)
			}
			if (schema === 'colist' || schema === 'costream') {
				if (Array.isArray(data)) return true
				if (typeof data === 'object' && data !== null && Array.isArray(data.items)) {
					return true
				}
				return false
			}
			return false
		},
		metaSchema: {
			enum: ['comap', 'colist', 'costream'],
		},
	},
	{
		keyword: 'indexing',
		validate: () => true,
		metaSchema: {
			type: 'boolean',
			description: 'Whether instances of this schema should be indexed in account.os.{schemaCoId}',
		},
	},
]

export const plugin = {
	keywords,
}
