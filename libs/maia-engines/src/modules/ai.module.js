export const config = {
	version: '1.0.0',
	description: 'Unified AI tool for OpenAI-compatible API integration (RedPill)',
	namespace: '@maia/actor/os',
	tools: ['@maia/actor/os/ai'],
}

export async function register(registry) {
	registry.registerModule(
		'ai',
		{ config, query: (q) => (q === 'tools' ? ['@maia/actor/os/ai'] : null) },
		{
			version: config.version,
			description: config.description,
			namespace: config.namespace,
			tools: config.tools,
		},
	)
}
