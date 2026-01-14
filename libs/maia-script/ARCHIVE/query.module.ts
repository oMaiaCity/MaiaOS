/**
 * MaiaScript Query Module
 * Query operations for filtering, sorting, paginating, and chaining queries
 * Phase 1: Core query operations using MaiaScript DSL
 */

import { maiaScriptModuleRegistry } from './registry'
import type { MaiaScriptModule, EvaluationContext } from './types'
import { evaluate as evaluateExpr } from './evaluator'
import type { MaiaScriptExpression } from './types'

/**
 * Helper to evaluate arguments recursively
 */
function evaluateArgs(args: any[], ctx: EvaluationContext): unknown[] {
  return args.map(arg => evaluateExpr(arg, ctx))
}

/**
 * Query Module
 * Provides query operations for filtering, sorting, paginating entities
 */
const queryModule: MaiaScriptModule = {
  name: 'query',
  version: '1.0.0',
  operations: {
    /**
     * $filter - Filter entities by conditions
     * Usage: { "$filter": { "field": "status", "condition": { "$eq": ["status", "todo"] } } }
     * Or: { "$filter": { "field": "status", "condition": { "$eq": [{ "$": "item.status" }, "todo"] } } }
     */
    '$filter': {
      name: '$filter',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const config = args[0] as { field: string; condition: MaiaScriptExpression }
        const entities = args[1] as Array<Record<string, unknown>>
        
        if (!Array.isArray(entities)) {
          throw new Error('$filter: Second argument must be an array of entities')
        }
        
        if (!config?.field || !config?.condition) {
          throw new Error('$filter: Requires field and condition')
        }
        
        // Evaluate condition for each entity
        return entities.filter((entity) => {
          // Create evaluation context with entity as 'item'
          const filterCtx: EvaluationContext = {
            ...ctx,
            item: entity as Record<string, unknown>
          }
          
          // Evaluate condition (should return boolean)
          const result = evaluateExpr(config.condition, filterCtx)
          return Boolean(result)
        })
      }
    },

    /**
     * $sort - Sort entities by field
     * Usage: { "$sort": { "field": "createdAt", "order": "desc" } }
     */
    '$sort': {
      name: '$sort',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const config = args[0] as { field: string; order?: 'asc' | 'desc' }
        const entities = args[1] as Array<Record<string, unknown>>
        
        if (!Array.isArray(entities)) {
          throw new Error('$sort: Second argument must be an array of entities')
        }
        
        if (!config?.field) {
          throw new Error('$sort: Requires field')
        }
        
        const order = config.order || 'asc'
        const field = config.field
        
        // Sort entities
        return [...entities].sort((a, b) => {
          const aVal = a[field]
          const bVal = b[field]
          
          if (aVal === bVal) return 0
          if (aVal == null) return 1
          if (bVal == null) return -1
          
          let comparison = 0
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal)
          } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal
          } else {
            comparison = String(aVal).localeCompare(String(bVal))
          }
          
          return order === 'asc' ? comparison : -comparison
        })
      }
    },

    /**
     * $paginate - Limit and offset entities
     * Usage: { "$paginate": { "limit": 10, "offset": 0 } }
     */
    '$paginate': {
      name: '$paginate',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const config = args[0] as { limit?: number; offset?: number }
        const entities = args[1] as Array<Record<string, unknown>>
        
        if (!Array.isArray(entities)) {
          throw new Error('$paginate: Second argument must be an array of entities')
        }
        
        let result = entities
        
        // Apply offset
        if (config?.offset) {
          result = result.slice(config.offset)
        }
        
        // Apply limit
        if (config?.limit) {
          result = result.slice(0, config.limit)
        }
        
        return result
      }
    },

    /**
     * $pipe - Chain query operations together
     * Usage: { "$pipe": [op1, op2, op3] }
     * Each operation receives the result of the previous operation as second argument
     */
    '$pipe': {
      name: '$pipe',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const operations = args[0] as MaiaScriptExpression[]
        const initialEntities = args[1] as Array<Record<string, unknown>>
        
        if (!Array.isArray(operations)) {
          throw new Error('$pipe: First argument must be an array of operations')
        }
        
        if (!Array.isArray(initialEntities)) {
          throw new Error('$pipe: Second argument must be an array of entities')
        }
        
        // Execute operations in sequence
        let result: Array<Record<string, unknown>> = initialEntities
        
        for (const operation of operations) {
          // Each operation is a MaiaScript expression object like { "$filter": { ... } }
          // We need to evaluate it with result as the entities argument
          
          if (typeof operation !== 'object' || operation === null || Array.isArray(operation)) {
            throw new Error('$pipe: Each operation must be a MaiaScript expression object')
          }
          
          // Get operation type (e.g., "$filter", "$sort")
          const opKeys = Object.keys(operation)
          if (opKeys.length !== 1) {
            throw new Error('$pipe: Each operation must have exactly one key')
          }
          
          const opKey = opKeys[0]
          const opConfig = (operation as any)[opKey]
          
          // Get the operation from registry
          const op = maiaScriptModuleRegistry.getOperation(opKey)
          if (!op) {
            throw new Error(`$pipe: Operation "${opKey}" not found`)
          }
          
          // Call operation with [config, currentResult]
          // Operations expect: evaluate([config, entities], ctx)
          const opResult = op.evaluate([opConfig, result], ctx)
          
          if (!Array.isArray(opResult)) {
            throw new Error(`$pipe: Operation "${opKey}" must return an array`)
          }
          
          result = opResult as Array<Record<string, unknown>>
        }
        
        return result
      }
    }
  }
}

// Auto-register on import
maiaScriptModuleRegistry.register(queryModule)

export { queryModule }
