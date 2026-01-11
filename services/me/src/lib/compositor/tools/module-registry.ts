/**
 * Tool Module Registry - Central registration for tool modules
 * Follows MaiaScript module pattern for consistency
 * 
 * UNIFIED ARCHITECTURE:
 * - Builtin modules: Always loaded (core, context)
 * - Optional modules: Loaded explicitly (ai, human, etc.)
 * - Module-based organization: Cleaner than flat registry
 */

import type { ToolModule, ToolModuleRegistry as IToolModuleRegistry } from './module-types'
import type { Tool } from './types'

class ToolModuleRegistryImpl implements IToolModuleRegistry {
  private modules: Map<string, ToolModule> = new Map()
  
  /**
   * Register a tool module
   */
  register(module: ToolModule): void {
    if (this.modules.has(module.name)) {
      console.warn(`[ToolModuleRegistry] Module "${module.name}" already registered, skipping`)
      return
    }
    
    this.modules.set(module.name, module)
  }
  
  /**
   * Get a module by name
   */
  get(moduleName: string): ToolModule | undefined {
    return this.modules.get(moduleName)
  }
  
  /**
   * Get all registered modules
   */
  getAll(): ToolModule[] {
    return Array.from(this.modules.values())
  }
  
  /**
   * Get a specific tool by ID across all registered modules
   * This is the primary lookup method for tool execution
   */
  getTool(toolId: string): Tool | undefined {
    // Search all registered modules for the tool
    for (const module of this.modules.values()) {
      if (module.tools[toolId]) {
        return module.tools[toolId]
      }
    }
    return undefined
  }
  
  /**
   * Check if a tool exists
   */
  hasTool(toolId: string): boolean {
    return this.getTool(toolId) !== undefined
  }
  
  /**
   * Get all tools across all modules (for debugging/introspection)
   */
  getAllTools(): Tool[] {
    const allTools: Tool[] = []
    for (const module of this.modules.values()) {
      allTools.push(...Object.values(module.tools))
    }
    return allTools
  }
  
  /**
   * Get tools by category across all modules
   */
  getToolsByCategory(category: string): Tool[] {
    return this.getAllTools().filter(tool => tool.metadata.category === category)
  }
}

/**
 * Global tool module registry instance
 * All tool modules register here (builtin + optional)
 */
export const toolModuleRegistry = new ToolModuleRegistryImpl()

// NOTE: Builtin modules (core, context) are auto-registered in their respective files
// Optional modules (ai, human) are registered explicitly via registerOptionalModules()
