export const config = {
	version: '1.0.0',
	description: 'Core UI tools (view modes, modals, utilities)',
	namespace: '@core',
	tools: ['preventDefault'],
}

export async function register(registry) {
	registry.registerModule(
		'core',
		{ config, query: () => null },
		{
			version: config.version,
			description: config.description,
			namespace: config.namespace,
			tools: config.tools,
		},
	)
}
