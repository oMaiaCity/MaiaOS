/** CoJSON plugin: $co, cotype, indexing keywords */
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
				{ pattern: '^co_z[a-zA-Z0-9]+$' },
				{ pattern: '^°[a-zA-Z0-9_-]+/factory/' },
				{ pattern: '^@[a-zA-Z0-9_-]+/factory/' },
			],
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
		metaSchema: { enum: ['comap', 'colist', 'costream', 'cobinary'] },
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
