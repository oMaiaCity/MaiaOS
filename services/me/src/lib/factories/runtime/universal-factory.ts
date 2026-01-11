/**
 * Universal Factory Loader
 * Single generic interpreter for ALL JSON factory configs
 * Works for composites, leafs, and any view node
 * 
 * SUPPORTS CONDITIONAL FACTORIES (using secure DSL):
 * - $factoryIf: Conditional structures based on parameters (uses DSL evaluation)
 * - $factorySwitch: Multi-way branching for variants (parameter lookup)
 * - Parameter-based conditionals are evaluated BEFORE template substitution
 */

import type { CompositeNode, ViewNode } from '$lib/compositor/view/types';
import type { LeafNode } from '$lib/compositor/view/leaf-types';
import { safeEvaluate } from '$lib/compositor/dsl';
import type { DSLExpression } from '$lib/compositor/dsl';

/**
 * Conditional factory structure
 */
interface FactoryConditional {
  $factoryIf?: {
    test: DSLExpression; // DSL expression evaluated against parameters
    then: any;
    else?: any;
  };
  $factorySwitch?: {
    param: string; // Parameter name to switch on (e.g., "variant")
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
 * Process factory conditionals ($factoryIf, $factorySwitch)
 * Uses SECURE DSL evaluation - no code execution!
 */
function processConditionals(factory: any, params: Record<string, any>, maps?: Record<string, Record<string, any>>): any {
  // Handle $factoryIf conditional (uses secure DSL evaluation)
  if (factory.$factoryIf) {
    const testExpression = factory.$factoryIf.test;
    
    // Evaluate DSL expression against parameters (SECURE - no code execution!)
    const result = safeEvaluate(testExpression, params);
    const passes = Boolean(result);
    
    return passes ? factory.$factoryIf.then : (factory.$factoryIf.else || {});
  }

  // Handle $factorySwitch conditional (parameter lookup only - no evaluation)
  if (factory.$factorySwitch) {
    const paramName = factory.$factorySwitch.param;
    const switchValue = params[paramName];
    const cases = factory.$factorySwitch.cases;
    
    // Look up the case (simple key lookup - no evaluation)
    if (switchValue !== undefined && switchValue !== null && switchValue in cases) {
      return cases[String(switchValue)];
    }
    
    // Fallback to default
    return factory.$factorySwitch.default || {};
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
      // Return the parameter value directly (preserves DSL objects, numbers, booleans, etc.)
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
 * Universal Factory Loader
 * Works with ANY JSON factory config
 * Supports conditionals ($if, $switch) and maps
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
