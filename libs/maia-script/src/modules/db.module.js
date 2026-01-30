import dbTool from '@MaiaOS/tools/db/db.tool.js';
import dbToolDef from '@MaiaOS/tools/db/db.tool.maia';

export const config = {
  version: '1.0.0',
  description: 'Unified database operation API',
  namespace: '@db',
  tools: ['@db']
};

export async function register(registry) {
  const toolEngine = registry._getToolEngine('DBModule');
  toolEngine.tools.set('@db', {
    definition: dbToolDef,
    function: dbTool,
    namespacePath: 'db/db'
  });
  registry.registerModule('db', { config, query: (q) => q === 'tools' ? ['@db'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
