export const config = {
  version: '1.0.0',
  description: 'Actor interface validation and schema management',
  namespace: '@interface',
  tools: ['validateInterface']
};

export async function register(registry) {
  const toolNames = config.tools;
  const registeredTools = await registry._registerToolsFromRegistry('interface', toolNames, config.namespace, { silent: true });
  registry.registerModule('interface', { config, query: () => null }, {
    version: config.version,
    description: config.description,
    namespace: config.namespace,
    tools: registeredTools
  });
}
