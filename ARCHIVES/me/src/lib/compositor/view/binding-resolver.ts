/**
 * Binding Resolver Module
 * Resolves data bindings to concrete values
 * Part of Phase 2: Modular Architecture
 */

import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'
import { resolveDataPath } from './resolver'

/**
 * Resolve a binding to a concrete value
 * Supports both data paths and MaiaScript expressions
 */
export function resolveBinding(
  binding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): unknown {
  if (!binding) return undefined
  
  // MaiaScript expression
  if (isMaiaScriptExpression(binding)) {
    try {
      // Build evaluation context - access properties to ensure reactivity
      const evalContext: Record<string, unknown> = {}
      
      if ("item" in data && data.item) {
        const _item = data.item // Track item for reactivity
        evalContext.item = data.item as Record<string, unknown>
      }
      
      if ("context" in data && data.context) {
        const _context = data.context // Track context for reactivity
        // ✅ Drill into all context properties for deep reactivity
        if (_context && typeof _context === 'object') {
          for (const contextKey in _context) {
            const _contextValue = _context[contextKey] // Track all context properties
          }
        }
        evalContext.context = data.context as Record<string, unknown>
      }
      
      if ("dependencies" in data && data.dependencies) {
        const _dependencies = data.dependencies // Track dependencies for reactivity
        // Drill into dependency properties for reactivity
        if (typeof _dependencies === 'object' && _dependencies !== null) {
          for (const [key, dep] of Object.entries(_dependencies)) {
            if (dep && typeof dep === 'object' && 'context' in dep) {
              const _depContext = (dep as any).context // Track dep.context
              if (_depContext && typeof _depContext === 'object') {
                for (const contextKey in _depContext) {
                  const _contextValue = _depContext[contextKey] // Track all context properties
                }
              }
            }
          }
        }
        evalContext.dependencies = data.dependencies as Record<string, unknown>
      }
      
      return safeEvaluate(binding, evalContext)
    } catch (error) {
      console.warn('[BindingResolver] MaiaScript evaluation error:', error)
      return undefined
    }
  }
  
  // Simple data path
  if (typeof binding === 'string') {
    return resolveDataPath(data, binding)
  }
  
  return undefined
}

/**
 * Resolve all bindings in a bindings object
 */
export function resolveBindings(
  bindings: Record<string, any> | undefined,
  data: Record<string, any>
): Record<string, any> {
  if (!bindings) return {}
  
  const resolved: Record<string, any> = {}
  for (const [key, value] of Object.entries(bindings)) {
    resolved[key] = resolveBinding(value, data)
  }
  return resolved
}

/**
 * Helper: Evaluate visibility binding (returns boolean)
 */
export function resolveVisibility(
  visibilityBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): boolean {
  if (!visibilityBinding) return true
  
  const value = resolveBinding(visibilityBinding, data)
  return value !== undefined && value !== null && value !== false
}

/**
 * Helper: Resolve class binding (returns string)
 */
export function resolveClass(
  classBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): string {
  if (!classBinding) return ''
  
  const value = resolveBinding(classBinding, data)
  return typeof value === 'string' ? value : ''
}

/**
 * Helper: Resolve text binding (returns string)
 */
export function resolveText(
  textBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): string {
  if (!textBinding) return ''
  
  const value = resolveBinding(textBinding, data)
  return value !== undefined ? String(value) : ''
}

/**
 * Helper: Resolve disabled binding (returns boolean)
 */
export function resolveDisabled(
  disabledBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): boolean {
  if (!disabledBinding) return false
  
  const value = resolveBinding(disabledBinding, data)
  return Boolean(value)
}

/**
 * Helper: Resolve value binding (returns any type)
 */
export function resolveValue(
  valueBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): unknown {
  if (!valueBinding) return undefined
  
  return resolveBinding(valueBinding, data)
}
