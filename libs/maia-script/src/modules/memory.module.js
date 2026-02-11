import { getTool } from '@MaiaOS/tools';

export const config = {
  version: '1.0.0',
  description: 'Memory tool for Honcho integration',
  namespace: '@memory',
  tools: ['@memory']
};

export async function register(registry) {
  const tool = getTool('memory/memory');
  if (!tool) return;
  const toolEngine = registry._getToolEngine('MemoryModule');
  toolEngine.tools.set('@memory', {
    definition: tool.definition,
    function: tool.function,
    namespacePath: 'memory/memory'
  });
  registry.registerModule('memory', { config, query: (q) => q === 'tools' ? ['@memory'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
