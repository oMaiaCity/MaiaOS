import { getTool } from '@MaiaOS/tools';

export const config = {
  version: '1.0.0',
  description: 'Sparks tool for managing collaborative spaces (groups)',
  namespace: '@sparks',
  tools: ['@sparks']
};

export async function register(registry) {
  const tool = getTool('sparks/sparks');
  if (!tool) return;
  const toolEngine = registry._getToolEngine('SparksModule');
  toolEngine.tools.set('@sparks', {
    definition: tool.definition,
    function: tool.function,
    namespacePath: 'sparks/sparks'
  });
  registry.registerModule('sparks', { config, query: (q) => q === 'tools' ? ['@sparks'] : null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: config.tools
  });
}
