/**
 * Tools Index - Module-based registration
 * 
 * UNIFIED ARCHITECTURE:
 * - Builtin modules (core, context) are auto-registered in their module files
 * - Optional modules (ai, human) are registered explicitly here
 * - All tools accessible via toolModuleRegistry.getTool(toolId)
 * - ToolEngine handles execution with MaiaScript DSL integration
 */

// ========== TYPES ==========
export * from './types'
export * from './module-types'
export * from './module-registry'

// ========== ENGINES ==========
export { ToolEngine } from '../engines/ToolEngine'

// ========== REGISTRY ==========
export { toolModuleRegistry } from './module-registry'

// Import optional modules
import { aiModule } from './ai.module'
import { humanModule } from './human.module'
import { toolModuleRegistry } from './module-registry'

// Import core and context modules (just to ensure they're loaded)
import './core.module'
import './context.module'

let modulesRegistered = false

/**
 * Register optional tool modules
 * Core modules (core, context) are always available (auto-registered in their files)
 */
export function registerOptionalModules(): void {
  if (modulesRegistered) {
    console.log('[Tools] Optional modules already registered, skipping')
    return
  }
  
  toolModuleRegistry.register(aiModule)
  toolModuleRegistry.register(humanModule)
  // Add more optional modules here as needed
  
  modulesRegistered = true
  console.log('[Tools] ✅ Registered optional modules:', ['ai', 'human'])
}

/**
 * Register ALL tools (builtin + optional)
 * Convenience function for initialization
 */
export function registerAllTools(): void {
  // Core and context are already registered (auto-registration in module files)
  registerOptionalModules()
  
  const allTools = toolModuleRegistry.getAllTools()
  console.log(`[Tools] Total registered tools: ${allTools.length}`)
  console.log('[Tools] Available tool IDs:', allTools.map(t => t.metadata.id))
}
