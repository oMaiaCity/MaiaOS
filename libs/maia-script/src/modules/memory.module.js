import memoryTool from '@MaiaOS/tools/memory/memory.tool.js';
import memoryToolDef from '@MaiaOS/tools/memory/memory.tool.maia';

export const config = {
  version: '1.0.0',
  description: 'Memory tool for Honcho integration',
  namespace: '@memory',
  tools: ['@memory']
};

export async function register(registry) {
  const toolEngine = registry._getToolEngine('MemoryModule');
  toolEngine.tools.set('@memory', {
    definition: memoryToolDef,
    function: memoryTool,
    namespacePath: 'memory/memory'
  });
  registry.registerModule('memory', { config, query: (q) => q === 'tools' ? ['@memory'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
