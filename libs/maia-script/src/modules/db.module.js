import dbTool from '@MaiaOS/tools/db/db.tool.js';
import dbToolDef from '@MaiaOS/tools/db/db.tool.maia';
import { getToolEngine, registerModuleConfig } from '../utils/module-registration.js';

export class DBModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'DBModule');
    toolEngine.tools.set('@db', {
      definition: dbToolDef,
      function: dbTool,
      namespacePath: 'db/db'
    });
    registerModuleConfig(registry, 'db', DBModule, {
      version: '1.0.0',
      description: 'Unified database operation API',
      namespace: '@db',
      tools: ['@db']
    });
  }

  static query(query) {
    return query === 'tools' ? ['@db'] : null;
  }
}

export async function register(registry) {
  return await DBModule.register(registry);
}
