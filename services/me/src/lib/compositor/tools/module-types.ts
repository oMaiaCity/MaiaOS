/**
 * Tool Module System - Type Definitions
 * Matches MaiaScript module pattern
 */

import type { Tool } from './types'

/**
 * Tool Module - Pluggable tool collection
 * Similar to MaiaScript modules but for tools/actions
 */
export interface ToolModule {
  name: string
  version: string
  tools: Record<string, Tool>
  builtin?: boolean // Core modules are always loaded
}

/**
 * Tool Module Registry - Central registration
 * Manages all tool modules (builtin + optional)
 */
export interface ToolModuleRegistry {
  register(module: ToolModule): void
  get(moduleName: string): ToolModule | undefined
  getAll(): ToolModule[]
  getTool(toolId: string): Tool | undefined
}
