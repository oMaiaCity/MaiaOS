import { registerOperations } from './db/register-operations.js'

export const config = {
	version: '1.0.0',
	description: 'Unified database operation API',
	namespace: '@maia/actor/os',
	tools: ['@maia/actor/os/db'],
}

export async function register(registry) {
	const dataEngine = registry._dataEngine
	if (dataEngine) {
		registerOperations(dataEngine)
	}

	registry.registerModule(
		'db',
		{ config, query: (q) => (q === 'tools' ? ['@maia/actor/os/db'] : null) },
		{
			version: config.version,
			description: config.description,
			namespace: config.namespace,
			tools: config.tools,
		},
	)
}
