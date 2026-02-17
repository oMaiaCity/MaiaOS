import { getTool } from '@MaiaOS/tools'

export const config = {
	version: '1.0.0',
	description: 'Unified AI tool for OpenAI-compatible API integration (RedPill)',
	namespace: '@ai',
	tools: ['@ai/chat'],
}

export async function register(registry) {
	const tool = getTool('ai/chat')
	if (!tool) return
	const toolEngine = registry._getToolEngine('AiModule')
	toolEngine.tools.set('@ai/chat', {
		definition: tool.definition,
		function: tool.function,
		namespacePath: 'ai/chat',
	})
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
