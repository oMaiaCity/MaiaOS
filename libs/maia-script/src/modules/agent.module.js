import agentTool from '@MaiaOS/tools/agent/agent.tool.js';
import agentToolDef from '@MaiaOS/tools/agent/agent.tool.maia';

export const config = {
  version: '1.0.0',
  description: 'Unified agent tool for OpenAI-compatible API integration (RedPill)',
  namespace: '@agent',
  tools: ['@agent/chat']
};

export async function register(registry) {
  const toolEngine = registry._getToolEngine('AgentModule');
  toolEngine.tools.set('@agent/chat', {
    definition: agentToolDef,
    function: agentTool,
    namespacePath: 'agent/chat'
  });
  registry.registerModule('agent', { config, query: (q) => q === 'tools' ? ['@agent/chat'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
