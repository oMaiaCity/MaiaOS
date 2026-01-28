import { getTool } from '@MaiaOS/tools';

export function getToolEngine(registry, moduleName) {
  const toolEngine = registry._toolEngine;
  if (!toolEngine) {
    throw new Error(`[${moduleName}] ToolEngine not available in registry`);
  }
  return toolEngine;
}

export async function registerToolsFromRegistry(registry, toolEngine, moduleName, toolNames, namespace, options = {}) {
  const { silent = false } = options;
  const registeredTools = [];
  
  for (const toolName of toolNames) {
    try {
      const tool = getTool(`${moduleName}/${toolName}`);
      if (tool) {
        await toolEngine.registerTool(`${moduleName}/${toolName}`, `${namespace}/${toolName}`, {
          definition: tool.definition,
          function: tool.function
        });
        registeredTools.push(`${namespace}/${toolName}`);
      }
    } catch (error) {
      if (!silent) {
        console.error(`[${moduleName}] Failed to register ${namespace}/${toolName}:`, error.message);
      }
    }
  }
  
  return registeredTools;
}

export function registerModuleConfig(registry, moduleName, ModuleClass, config) {
  registry.registerModule(moduleName, ModuleClass, {
    version: config.version || '1.0.0',
    description: config.description,
    namespace: config.namespace,
    tools: config.tools || []
  });
}
