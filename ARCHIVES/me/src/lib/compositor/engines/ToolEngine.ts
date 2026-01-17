/**
 * ToolEngine - Unified JSON → Engine → Output pattern
 * 
 * Matches pattern used by:
 * - factoryEngine: JSON config → ViewNode
 * - ActorEngine: Actor ID → Rendered UI
 * - ViewEngine: ViewNode → DOM
 * 
 * SECURITY: All payloads pass through MaiaScript DSL evaluation
 * - Whitelist-based property traversal (item, context, dependencies)
 * - No eval() or unsafe code execution
 * - Prototype pollution prevention
 * 
 * FUTURE: LLM Tool Call Integration
 * - Tools designed for dual invocation (actors + LLMs)
 * - Metadata maps 1:1 to LLM tool schemas
 */

import { toolModuleRegistry } from '../tools/module-registry'
import { safeEvaluate } from '@maia/script'
import type { AccountCoState } from 'jazz-tools/svelte'

/**
 * Check if a value is a MaiaScript expression
 * MaiaScript expressions are objects with keys starting with $
 */
function isMaiaScriptExpression(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  
  // Check if any key starts with $
  const keys = Object.keys(value)
  return keys.some(key => key.startsWith('$'))
}

/**
 * ToolEngine - Execute tools with MaiaScript DSL payload evaluation
 */
export class ToolEngine {
  /**
   * Execute tool with MaiaScript DSL payload evaluation
   * 
   * @param toolId - Tool identifier (e.g., '@core/createEntity', '@context/update')
   * @param actor - Actor instance (Jazz CoMap) that triggered the tool
   * @param payload - Tool payload (may contain MaiaScript expressions)
   * @param accountCoState - Jazz account CoState (for database operations)
   */
  static async execute(
    toolId: string,
    actor: any,
    payload?: unknown,
    accountCoState?: AccountCoState<any>
  ): Promise<void> {
    // Get tool from registry (searches all modules)
    const tool = toolModuleRegistry.getTool(toolId)
    if (!tool) {
      console.error(`[ToolEngine] Tool "${toolId}" not found in any registered module`)
      console.error(`[ToolEngine] Available tools:`, toolModuleRegistry.getAllTools().map(t => t.metadata.id))
      throw new Error(`Tool "${toolId}" not found in any registered module`)
    }
    
    // Evaluate payload through MaiaScript DSL (centralized security)
    const evaluatedPayload = this.evaluatePayload(payload, actor)
    
    // Execute tool with evaluated payload
    try {
      await tool.execute(actor, evaluatedPayload, accountCoState)
    } catch (error) {
      console.error(`[ToolEngine] ❌ Error executing tool "${toolId}":`, error)
      throw new Error(`Error executing tool "${toolId}": ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * Evaluate payload through MaiaScript DSL
   * Recursively evaluates all MaiaScript expressions in the payload
   * 
   * @param payload - Raw payload (may contain MaiaScript expressions)
   * @param actor - Actor instance (provides context for evaluation)
   * @returns Evaluated payload with all MaiaScript expressions resolved
   */
  private static evaluatePayload(payload: unknown, actor: any): unknown {
    if (!payload) return payload
    
    // Build evaluation context (matches DSL context in ViewEngine)
    const context = {
      context: actor.context || {},
      dependencies: actor.dependencies || {},
      item: {} // For foreach contexts
    }
    
    // If payload is MaiaScript expression, evaluate it
    if (isMaiaScriptExpression(payload)) {
      try {
        const result = safeEvaluate(payload, context)
        return result
      } catch (error) {
        console.error(`[ToolEngine] Failed to evaluate MaiaScript expression:`, payload, error)
        return payload // Return original if evaluation fails
      }
    }
    
    // If payload is object, recursively evaluate all properties
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(payload)) {
        result[key] = this.evaluatePayload(value, actor)
      }
      return result
    }
    
    // If payload is array, recursively evaluate all elements
    if (Array.isArray(payload)) {
      return payload.map(item => this.evaluatePayload(item, actor))
    }
    
    // String path resolution (e.g., "context.newTodoText")
    // Convert to MaiaScript expression and evaluate
    if (typeof payload === 'string' && (payload.startsWith('context.') || payload.startsWith('dependencies.'))) {
      try {
        const result = safeEvaluate({ "$": payload }, context)
        return result
      } catch (error) {
        console.error(`[ToolEngine] Failed to resolve string path:`, payload, error)
        return payload // Return original if resolution fails
      }
    }
    
    return payload
  }
  
  /**
   * Batch execution (for future LLM multi-tool calls)
   * Executes multiple tools in parallel
   * 
   * @param calls - Array of tool calls to execute
   * @param accountCoState - Jazz account CoState (shared across all calls)
   */
  static async executeBatch(
    calls: Array<{ toolId: string; actor: any; payload?: unknown }>,
    accountCoState?: AccountCoState<any>
  ): Promise<void[]> {
    return Promise.all(
      calls.map(call => this.execute(call.toolId, call.actor, call.payload, accountCoState))
    )
  }
  
  /**
   * Validate tool exists before execution
   * Useful for pre-flight checks
   * 
   * @param toolId - Tool identifier to validate
   * @returns true if tool exists, false otherwise
   */
  static validate(toolId: string): boolean {
    const exists = toolModuleRegistry.hasTool(toolId)
    if (!exists) {
      console.warn(`[ToolEngine] Tool validation failed: "${toolId}" not found`)
    }
    return exists
  }
  
  /**
   * Get tool metadata (for LLM tool schema generation)
   * 
   * @param toolId - Tool identifier
   * @returns Tool metadata or undefined if not found
   */
  static getToolMetadata(toolId: string) {
    const tool = toolModuleRegistry.getTool(toolId)
    return tool?.metadata
  }
  
  /**
   * Get all available tools (for debugging/introspection)
   * 
   * @returns Array of all registered tools
   */
  static getAllTools() {
    return toolModuleRegistry.getAllTools()
  }
}
