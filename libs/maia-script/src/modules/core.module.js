import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class CoreModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'CoreModule');
    const toolNames = ['noop', 'preventDefault', 'publishMessage', 'focus'];
    await registerToolsFromRegistry(registry, toolEngine, 'core', toolNames, '@core', { silent: true });
    registerModuleConfig(registry, 'core', CoreModule, {
      version: '1.0.0',
      description: 'Core UI tools (view modes, modals, utilities)',
      namespace: '@core',
      tools: toolNames.map(t => `@core/${t}`)
    });
  }

  static query(query) {
    return null;
  }
}

export async function register(registry) {
  await CoreModule.register(registry);
}
