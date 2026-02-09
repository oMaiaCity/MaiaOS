import aiTool from '@MaiaOS/tools/ai/ai.tool.js';
import aiToolDef from '@MaiaOS/tools/ai/ai.tool.maia';

export const config = {
  version: '1.0.0',
  description: 'Unified AI tool for OpenAI-compatible API integration (RedPill)',
  namespace: '@ai',
  tools: ['@ai/chat']
};

export async function register(registry) {
  const toolEngine = registry._getToolEngine('AiModule');
  toolEngine.tools.set('@ai/chat', {
    definition: aiToolDef,
    function: aiTool,
    namespacePath: 'ai/chat'
  });
  registry.registerModule('ai', { config, query: (q) => q === 'tools' ? ['@ai/chat'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
