import llmTool from '@MaiaOS/tools/llm/llm.tool.js';
import llmToolDef from '@MaiaOS/tools/llm/llm.tool.maia';

export const config = {
  version: '1.0.0',
  description: 'LLM tool for RedPill API integration',
  namespace: '@llm',
  tools: ['@llm/chat']
};

export async function register(registry) {
  const toolEngine = registry._getToolEngine('LLMModule');
  toolEngine.tools.set('@llm/chat', {
    definition: llmToolDef,
    function: llmTool,
    namespacePath: 'llm/llm'
  });
  registry.registerModule('llm', { config, query: (q) => q === 'tools' ? ['@llm/chat'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
