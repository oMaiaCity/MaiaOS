import privateLlmTool from '@MaiaOS/tools/private-llm/private-llm.tool.js';
import privateLlmToolDef from '@MaiaOS/tools/private-llm/private-llm.tool.maia';

export const config = {
  version: '1.0.0',
  description: 'Private LLM tool for RedPill API integration',
  namespace: '@private-llm',
  tools: ['@private-llm/chat']
};

export async function register(registry) {
  const toolEngine = registry._getToolEngine('PrivateLLMModule');
  toolEngine.tools.set('@private-llm/chat', {
    definition: privateLlmToolDef,
    function: privateLlmTool,
    namespacePath: 'private-llm/chat'
  });
  registry.registerModule('private-llm', { config, query: (q) => q === 'tools' ? ['@private-llm/chat'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
