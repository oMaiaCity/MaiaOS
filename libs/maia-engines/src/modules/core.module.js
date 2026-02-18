export const config = {
	version: '1.0.0',
	description: 'Core UI tools (view modes, modals, utilities)',
	namespace: '@core',
	tools: [
		'preventDefault',
		'publishMessage',
		'computeMessageNames',
		'updatePaperContent',
		'randomizePaperContent',
	],
}

export async function register(registry) {
	const toolNames = config.tools
	const registeredTools = await registry._registerToolsFromRegistry(
		'core',
		toolNames,
		config.namespace,
		{ silent: true },
	)
	registry.registerModule(
		'core',
		{ config, query: () => null },
		{
			version: config.version,
			description: config.description,
			namespace: config.namespace,
			tools: registeredTools,
		},
	)
}
