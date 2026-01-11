/**
 * MaiaScript Module System - Type Definitions
 * Phase 4: Module Registry Infrastructure
 */

/**
 * MaiaScript Module - Pluggable extension
 */
export interface MaiaScriptModule {
  name: string
  version: string
  operations: Record<string, MaiaScriptOperation>
  capabilities?: Record<string, Capability>
}

/**
 * MaiaScript Operation - Single atomic function
 */
export interface MaiaScriptOperation {
  name: string
  evaluate: (args: any[], ctx: EvaluationContext) => unknown
  validate?: (args: any[]) => ValidationResult
}

/**
 * Evaluation Context - Data scope for MaiaScript expressions
 */
export interface EvaluationContext {
  item?: Record<string, unknown>
  context?: Record<string, unknown>
  dependencies?: Record<string, unknown>
}

/**
 * Capability - Declarative node enhancement
 */
export interface Capability {
  name: string
  apply: (node: ViewNode, data: Record<string, any>) => ViewNode
}

/**
 * ViewNode - Generic type (imported from view system)
 * Note: This creates a dependency - consider moving to shared types
 */
export interface ViewNode {
  slot?: string
  composite?: any
  compositeId?: string
  leaf?: any
  leafId?: string
  capabilities?: string[]
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean
  errors?: string[]
}
