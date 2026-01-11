/**
 * FactoryEngine
 * Single generic interpreter for ALL JSON factory configs
 * Works for composites, leafs, and any view node
 * 
 * SUPPORTS CONDITIONAL FACTORIES (using secure MaiaScript):
 * - $if: Conditional structures (core MaiaScript, evaluated during factory loading)
 * - $switch: Multi-way branching (core MaiaScript, evaluated during factory loading)
 * - Parameter-based conditionals are evaluated BEFORE template substitution
 */

import type { CompositeNode, ViewNode, LeafNode } from '$lib/utils/types';
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script';
import type { MaiaScriptExpression } from '@maia/script';

/**
 * Conditional factory structure - Phase 8: Unified conditionals
 * Uses core MaiaScript operations ($if, $switch) evaluated during factory loading
 */
interface FactoryConditional {
  $if?: {
    test: MaiaScriptExpression; // Evaluated against parameters during factory loading
    then: any;
    else?: any;
  };
  $switch?: {
    on: MaiaScriptExpression; // Evaluated against parameters during factory loading
    cases: Record<string, any>; // Map of value -> factory structure
    default?: any;
  };
}

/**
 * Universal factory definition
 */
export interface UniversalFactoryDef {
  $schema: 'composite-factory' | 'leaf-factory' | 'view-factory';
  parameters?: Record<string, {
    type: string;
    required?: boolean;
    default?: any;
  }>;
  maps?: Record<string, Record<string, any>>; // Key-value mappings (e.g., variant -> classes)
  factory: ViewNode | FactoryConditional;
}

/**
 * Process factory conditionals ($if, $switch) - Phase 8: Unified conditionals
 * Uses core MaiaScript operations evaluated during factory loading
 */
function processConditionals(factory: any, params: Record<string, any>, maps?: Record<string, Record<string, any>>): any {
  // Handle $if conditional (core MaiaScript operation, evaluated during factory loading)
  if (factory.$if && typeof factory.$if === 'object' && 'test' in factory.$if) {
    const testExpression = factory.$if.test;
    
    // Evaluate MaiaScript expression against parameters (SECURE - no code execution!)
    const result = safeEvaluate(testExpression, { context: params });
    const passes = Boolean(result);
    
    // Recursively process the selected branch (then or else)
    const selectedBranch = passes ? factory.$if.then : (factory.$if.else || {});
    return processConditionals(selectedBranch, params, maps);
  }

  // Handle $switch conditional (core MaiaScript operation, evaluated during factory loading)
  if (factory.$switch && typeof factory.$switch === 'object' && 'on' in factory.$switch) {
    const switchExpression = factory.$switch.on;
    const cases = factory.$switch.cases || {};
    const defaultExpr = factory.$switch.default;
    
    // Evaluate switch expression against parameters
    const switchValue = safeEvaluate(switchExpression, { context: params });
    const switchKey = String(switchValue);
    
    // Look up the case
    if (switchKey in cases) {
      // Recursively process the selected case
      return processConditionals(cases[switchKey], params, maps);
    }
    
    // Fallback to default
    if (defaultExpr !== undefined) {
      return processConditionals(defaultExpr, params, maps);
    }
    
    return {};
  }

  // Handle $map lookup (e.g., variant -> classes)
  if (factory.$map && maps) {
    const mapName = factory.$map.name;
    const paramName = factory.$map.param;
    const key = params[paramName];
    
    if (mapName in maps && key in maps[mapName]) {
      return maps[mapName][key];
    }
    
    return factory.$map.default || '';
  }

  return factory;
}

/**
 * Deep substitute parameters in any value
 * Handles {{param}} syntax recursively
 */
function substitute(value: any, params: Record<string, any>): any {
  // String substitution
  if (typeof value === 'string') {
    // Check if the entire string is a single parameter substitution (e.g., "{{paramName}}")
    const singleParamMatch = value.match(/^\{\{(\w+)\}\}$/);
    if (singleParamMatch) {
      const key = singleParamMatch[1];
      if (!(key in params)) {
        throw new Error(`Missing parameter: ${key}`);
      }
      // Return the parameter value directly (preserves MaiaScript objects, numbers, booleans, etc.)
      return params[key];
    }
    
    // Otherwise, do string replacement (for template strings like "foo {{bar}} baz")
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in params)) {
        throw new Error(`Missing parameter: ${key}`);
      }
      return params[key];
    });
  }

  // Array substitution
  if (Array.isArray(value)) {
    return value.map(item => substitute(item, params));
  }

  // Object substitution (recursive)
  if (value !== null && typeof value === 'object') {
    // Check if it's a MaiaScript expression (should be preserved as-is)
    if (isMaiaScriptExpression(value)) {
      return value; // Return MaiaScript expression as-is
    }
    
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = substitute(val, params);
    }
    return result;
  }

  // Primitives (numbers, booleans, null)
  return value;
}

/**
 * Validate and merge parameters with defaults
 */
function prepareParams(
  factoryDef: UniversalFactoryDef,
  userParams: Record<string, any>
): Record<string, any> {
  const finalParams: Record<string, any> = {};

  // Apply defaults and validate required
  if (factoryDef.parameters) {
    for (const [name, def] of Object.entries(factoryDef.parameters)) {
      if (def.required && !(name in userParams) && def.default === undefined) {
        throw new Error(`Required parameter missing: ${name}`);
      }
      finalParams[name] = userParams[name] ?? def.default;
    }
  }

  // Add any extra user params (for flexibility)
  for (const [name, value] of Object.entries(userParams)) {
    if (!(name in finalParams)) {
      finalParams[name] = value;
    }
  }

  return finalParams;
}

/**
 * FactoryEngine
 * Works with ANY JSON factory config
 * Supports conditionals ($if, $switch) - Phase 8: Unified conditionals
 */
export function createFromFactory<T extends ViewNode = ViewNode>(
  factoryDef: UniversalFactoryDef,
  params: Record<string, any> = {}
): T {
  // Prepare parameters (validate, apply defaults)
  const finalParams = prepareParams(factoryDef, params);

  // Process conditionals FIRST (before parameter substitution)
  // This selects the correct factory structure based on parameters
  let resolvedFactory = processConditionals(factoryDef.factory, finalParams, factoryDef.maps);

  // Deep clone and substitute parameters into the selected structure
  return substitute(resolvedFactory, finalParams) as T;
}

/**
 * Async factory loader for dynamic imports
 * Example: await createFromFactoryAsync('./kanban.factory.json', { itemsPath: '...' })
 */
export async function createFromFactoryAsync<T extends ViewNode = ViewNode>(
  factoryPath: string,
  params: Record<string, any> = {}
): Promise<T> {
  const factoryDef: UniversalFactoryDef = await import(factoryPath);
  return createFromFactory<T>(factoryDef, params);
}

/**
 * Type-safe helpers for common node types
 */
export function createComposite(
  factoryDef: UniversalFactoryDef,
  params: Record<string, any> = {}
): CompositeNode {
  return createFromFactory(factoryDef, params) as CompositeNode;
}

export function createLeaf(
  factoryDef: UniversalFactoryDef,
  params: Record<string, any> = {}
): LeafNode {
  return createFromFactory(factoryDef, params) as LeafNode;
}
