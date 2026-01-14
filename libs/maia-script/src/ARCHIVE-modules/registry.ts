/**
 * MaiaScript Module Registry
 * Central plugin system for MaiaScript extensions
 * Phase 4: Module Registry Infrastructure
 */

import type { MaiaScriptModule, MaiaScriptOperation, Capability } from './types'

/**
 * MaiaScript Module Registry
 * Central plugin system for MaiaScript extensions
 */
class MaiaScriptModuleRegistry {
  private modules = new Map<string, MaiaScriptModule>()
  private operations = new Map<string, MaiaScriptOperation>()
  private capabilities = new Map<string, Capability>()

  /**
   * Register a MaiaScript module
   * Auto-registers all operations and capabilities
   */
  register(module: MaiaScriptModule): void {
    if (this.modules.has(module.name)) {
      console.warn(
        `[MaiaScript] Module "${module.name}" already registered, overwriting`
      )
    }
    
    this.modules.set(module.name, module)
    
    // Register all operations from this module
    for (const [opName, operation] of Object.entries(module.operations)) {
      if (this.operations.has(opName)) {
        console.warn(
          `[MaiaScript] Operation "${opName}" already registered, overwriting`
        )
      }
      this.operations.set(opName, operation)
    }
    
    // Register all capabilities from this module
    if (module.capabilities) {
      for (const [capName, capability] of Object.entries(module.capabilities)) {
        if (this.capabilities.has(capName)) {
          console.warn(
            `[MaiaScript] Capability "${capName}" already registered, overwriting`
          )
        }
        this.capabilities.set(capName, capability)
      }
    }
  }

  /**
   * Get a MaiaScript operation by name
   */
  getOperation(name: string): MaiaScriptOperation | undefined {
    return this.operations.get(name)
  }

  /**
   * Get a capability by name
   */
  getCapability(name: string): Capability | undefined {
    return this.capabilities.get(name)
  }

  /**
   * Get a module by name
   */
  getModule(name: string): MaiaScriptModule | undefined {
    return this.modules.get(name)
  }

  /**
   * List all registered modules
   */
  listModules(): MaiaScriptModule[] {
    return Array.from(this.modules.values())
  }

  /**
   * List all registered operations
   */
  listOperations(): MaiaScriptOperation[] {
    return Array.from(this.operations.values())
  }

  /**
   * List all registered capabilities
   */
  listCapabilities(): Capability[] {
    return Array.from(this.capabilities.values())
  }

  /**
   * Check if an operation exists
   */
  hasOperation(name: string): boolean {
    return this.operations.has(name)
  }

  /**
   * Check if a capability exists
   */
  hasCapability(name: string): boolean {
    return this.capabilities.has(name)
  }

  /**
   * Check if a module exists
   */
  hasModule(name: string): boolean {
    return this.modules.has(name)
  }

  /**
   * Clear all registered modules (for testing)
   */
  clear(): void {
    this.modules.clear()
    this.operations.clear()
    this.capabilities.clear()
  }
}

/**
 * Global singleton registry
 */
export const maiaScriptModuleRegistry = new MaiaScriptModuleRegistry()
