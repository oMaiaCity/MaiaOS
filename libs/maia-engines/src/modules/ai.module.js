export const config = {
	version: '1.0.0',
	description: 'Unified AI tool for OpenAI-compatible API integration (RedPill)',
	namespace: '@ai',
	tools: ['@ai/chat'],
}

export async function register(registry) {
	registry.registerModule(
		'ai',
		{ config, query: (q) => (q === 'tools' ? ['@ai/chat'] : null) },
		{
			version: config.version,
			description: config.description,
			namespace: config.namespace,
			tools: config.tools,
		},
	)
}
