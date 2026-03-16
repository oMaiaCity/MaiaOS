/**
 * CoJSON validation plugin for MaiaOS factories
 *
 * Registers AJV keywords:
 * - $co: Co-id reference macro
 * - cotype: CRDT type (comap, colist, costream, cobinary) at schema root
 * - indexing: Metadata for schema indexing (always passes)
 */

export const pluginId = '@factories/cojson'

export const keywords = [
	{
		keyword: '$co',
		macro: (factoryCoId) => ({
			type: 'string',
			pattern: '^co_z[a-zA-Z0-9]+$',
			_factoryRef: factoryCoId,
		}),
		metaSchema: {
			type: 'string',
			anyOf: [
				{
					pattern: '^co_z[a-zA-Z0-9]+$',
					description: 'Co-id reference (after transformation)',
				},
				{
					pattern: '^°[a-zA-Z0-9_-]+/factory/',
					description: 'Human-readable factory ID with ° prefix (e.g. °Maia/factory/...)',
				},
				{
					pattern: '^@[a-zA-Z0-9_-]+/factory/',
					description: 'Human-readable factory ID with @ prefix (e.g. @domain/factory/...)',
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
			// cobinary: RawBinaryCoStream - binary data, validated via schema properties at creation
			if (schema === 'cobinary') {
				// At schema validation time, data is the schema object; cotype validate passes
				return true
			}
			return false
		},
		metaSchema: {
			enum: ['comap', 'colist', 'costream', 'cobinary'],
		},
	},
	{
		keyword: 'indexing',
		validate: () => true,
		metaSchema: {
			type: 'boolean',
			description: 'Whether instances of this schema should be indexed in account.os.{factoryCoId}',
		},
	},
]

export const plugin = {
	keywords,
}
