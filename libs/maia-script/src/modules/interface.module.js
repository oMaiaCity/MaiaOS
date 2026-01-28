import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class InterfaceModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'InterfaceModule');
    const toolNames = ['validateInterface'];
    await registerToolsFromRegistry(registry, toolEngine, 'interface', toolNames, '@interface', { silent: true });
    registerModuleConfig(registry, 'interface', InterfaceModule, {
      version: '1.0.0',
      description: 'Actor interface validation and schema management',
      namespace: '@interface',
      tools: toolNames.map(t => `@interface/${t}`)
    });
  }

  static query(query) {
    return null;
  }
}

export async function register(registry) {
  await InterfaceModule.register(registry);
}
