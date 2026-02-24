export const config = {
	version: '1.0.0',
	description: 'Sparks tool for managing collaborative spaces (groups)',
	namespace: '@maia/actor/os',
	tools: ['@maia/actor/os/spark'],
}

export async function register(registry) {
	registry.registerModule(
		'sparks',
		{ config, query: (q) => (q === 'tools' ? ['@maia/actor/os/spark'] : null) },
		{
			version: config.version,
			description: config.description,
			namespace: config.namespace,
			tools: config.tools,
		},
	)
}
