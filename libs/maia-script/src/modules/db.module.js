import { getTool } from '@MaiaOS/tools';

export const config = {
  version: '1.0.0',
  description: 'Unified database operation API',
  namespace: '@db',
  tools: ['@db']
};

export async function register(registry) {
  const tool = getTool('db/db');
  if (!tool) return;
  const toolEngine = registry._getToolEngine('DBModule');
  toolEngine.tools.set('@db', {
    definition: tool.definition,
    function: tool.function,
    namespacePath: 'db/db'
  });
  registry.registerModule('db', { config, query: (q) => q === 'tools' ? ['@db'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
