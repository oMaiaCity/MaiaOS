/**
 * MaiaScript Builtin Module
 * Core operations for the MaiaScript language
 * Phase 5: Move existing operations to module system
 */

import { maiaScriptModuleRegistry } from './registry'
import type { MaiaScriptModule, EvaluationContext } from './types'
import { evaluate as evaluateExpr } from '../evaluator'
import type { MaiaScriptExpression } from '../types'

/**
 * Helper to evaluate arguments recursively
 */
function evaluateArgs(args: any[], ctx: EvaluationContext): unknown[] {
  return args.map(arg => evaluateExpr(arg, ctx))
}

/**
 * Builtin MaiaScript Module
 * Contains all core operations
 */
const builtinModule: MaiaScriptModule = {
  name: 'builtin',
  version: '1.0.0',
  operations: {
    // Data Access
    '$': {
      name: '$',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const path = args[0] as string
        const parts = path.split('.')
        const root = parts[0]

        // Only allow whitelisted root paths
        if (root !== 'item' && root !== 'context' && root !== 'dependencies') {
          throw new Error(`Unauthorized root path: ${root}`)
        }

        let current: any = ctx[root as keyof EvaluationContext]

        // Traverse the path
        for (let i = 1; i < parts.length; i++) {
          if (current === null || current === undefined) {
            return undefined
          }

          const part = parts[i]

          // Prevent prototype pollution
          if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
            throw new Error(`Unauthorized property access: ${part}`)
          }

          current = current[part]
        }

        return current
      }
    },

    // Comparison Operations
    '$eq': {
      name: '$eq',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        return a === b
      }
    },

    '$neq': {
      name: '$neq',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        return a !== b
      }
    },

    '$gt': {
      name: '$gt',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number') {
          return a > b
        }
        return false
      }
    },

    '$lt': {
      name: '$lt',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number') {
          return a < b
        }
        return false
      }
    },

    '$gte': {
      name: '$gte',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number') {
          return a >= b
        }
        return false
      }
    },

    '$lte': {
      name: '$lte',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number') {
          return a <= b
        }
        return false
      }
    },

    '$in': {
      name: '$in',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [value, array] = evaluateArgs(args, ctx)
        if (!Array.isArray(array)) return false
        return array.includes(value)
      }
    },

    // Logical Operations
    '$and': {
      name: '$and',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        for (const arg of args) {
          const result = evaluateExpr(arg, ctx)
          if (!result) return false
        }
        return true
      }
    },

    '$or': {
      name: '$or',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        for (const arg of args) {
          const result = evaluateExpr(arg, ctx)
          if (result) return true
        }
        return false
      }
    },

    '$not': {
      name: '$not',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        return !evaluateExpr(arg, ctx)
      }
    },

    // Control Flow
    '$if': {
      name: '$if',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        // args is { test, then, else }
        const ifExpr = args[0] as { test: MaiaScriptExpression; then: MaiaScriptExpression; else?: MaiaScriptExpression }
        const condition = evaluateExpr(ifExpr.test, ctx)
        const elseExpr = ifExpr.else
        
        // Handle undefined elseExpr (defaults to empty string)
        if (elseExpr === undefined || elseExpr === null) {
          return condition ? evaluateExpr(ifExpr.then, ctx) : ''
        }
        
        return condition
          ? evaluateExpr(ifExpr.then, ctx)
          : evaluateExpr(elseExpr, ctx)
      }
    },

    '$switch': {
      name: '$switch',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        // args is { on, cases, default }
        const switchExpr = args[0] as {
          on: MaiaScriptExpression
          cases: Record<string, MaiaScriptExpression>
          default: MaiaScriptExpression
        }
        
        const value = evaluateExpr(switchExpr.on, ctx)
        const key = String(value)

        if (key in switchExpr.cases) {
          return evaluateExpr(switchExpr.cases[key], ctx)
        }

        return evaluateExpr(switchExpr.default, ctx)
      }
    },

    // String Operations
    '$concat': {
      name: '$concat',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        return args
          .map(e => String(evaluateExpr(e, ctx)))
          .join('')
      }
    },

    '$trim': {
      name: '$trim',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        const value = evaluateExpr(arg, ctx)
        return typeof value === 'string' ? value.trim() : String(value).trim()
      }
    },

    '$uppercase': {
      name: '$uppercase',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        const value = evaluateExpr(arg, ctx)
        return typeof value === 'string'
          ? value.toUpperCase()
          : String(value).toUpperCase()
      }
    },

    '$lowercase': {
      name: '$lowercase',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        const value = evaluateExpr(arg, ctx)
        return typeof value === 'string'
          ? value.toLowerCase()
          : String(value).toLowerCase()
      }
    },

    '$stringify': {
      name: '$stringify',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        const value = evaluateExpr(arg, ctx)
        const indent = 2 // Default indentation
        try {
          return JSON.stringify(value, null, indent)
        } catch (error) {
          return `[Unable to stringify: ${error}]`
        }
      }
    },

    '$includes': {
      name: '$includes',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [str, substring] = evaluateArgs(args, ctx)
        const evalStr = String(str)
        const evalSubstring = String(substring)
        return evalStr.includes(evalSubstring)
      }
    },

    // Date Operations
    '$formatDate': {
      name: '$formatDate',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [timestampExpr, format] = args
        const timestamp = evaluateExpr(timestampExpr, ctx) as number

        if (!timestamp) return ''

        try {
          const date = new Date(timestamp)
          if (isNaN(date.getTime())) return ''

          // Simple format handling
          if (format === 'MMM d, yyyy') {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          }

          // Default format
          return date.toLocaleDateString('en-US')
        } catch {
          return ''
        }
      }
    },

    '$now': {
      name: '$now',
      evaluate: () => {
        return Date.now()
      }
    },

    // Math Operations
    '$add': {
      name: '$add',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number') {
          return a + b
        }
        return 0
      }
    },

    '$subtract': {
      name: '$subtract',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number') {
          return a - b
        }
        return 0
      }
    },

    '$multiply': {
      name: '$multiply',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number') {
          return a * b
        }
        return 1
      }
    },

    '$divide': {
      name: '$divide',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [a, b] = evaluateArgs(args, ctx)
        if (typeof a === 'number' && typeof b === 'number' && b !== 0) {
          return a / b
        }
        return 0
      }
    },

    // Date Operations (Enhanced)
    '$toISOString': {
      name: '$toISOString',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [timestamp] = evaluateArgs(args, ctx)
        if (typeof timestamp === 'number') {
          try {
            return new Date(timestamp).toISOString()
          } catch {
            return ''
          }
        }
        return ''
      }
    },

    // Coercion Operations
    '$string': {
      name: '$string',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        const value = evaluateExpr(arg, ctx)
        return String(value)
      }
    },

    '$number': {
      name: '$number',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        const value = evaluateExpr(arg, ctx)
        return Number(value)
      }
    },

    '$boolean': {
      name: '$boolean',
      evaluate: (args: any[], ctx: EvaluationContext) => {
        const [arg] = args
        const value = evaluateExpr(arg, ctx)
        return Boolean(value)
      }
    },
  }
}

// Auto-register on import
maiaScriptModuleRegistry.register(builtinModule)

export { builtinModule }
