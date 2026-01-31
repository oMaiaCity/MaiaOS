/**
 * Map Transform - Apply mapping transformations to read data
 * 
 * Supports MaiaScript expressions in map definitions to transform data during read operations.
 * Fully generic - can map ANY property path, not limited to specific properties.
 * 
 * Example:
 * {
 *   "op": "read",
 *   "schema": "@schema/message",
 *   "map": {
 *     "fromRole": "$$source.role",
 *     "toRole": "$$target.role",
 *     "nestedValue": "$$nested.deep.property",
 *     "anyField": "$$anyProperty.anyNested.field"
 *   }
 * }
 * 
 * Note: Expressions MUST use $$ (double dollar) prefix for item access - strict syntax required
 * - $$source.role → accesses item.source.role
 * - $$target.id → accesses item.target.id
 * - $$nested.deep.property → accesses item.nested.deep.property (fully generic)
 * - Any property path is supported - no hardcoded restrictions
 * - Expressions without $$ prefix will throw an error
 */

// Import Evaluator dynamically to avoid circular dependencies
// Evaluator is used for evaluating MaiaScript expressions in map transformations
import { resolveCoValueReferences } from './data-extraction.js';

/**
 * Apply map transformation to a single item
 * @param {Object} backend - Backend instance
 * @param {Object} item - Item data to transform
 * @param {Object} mapConfig - Map configuration object (e.g., { "sender": "$$source.role" })
 * @param {Object} options - Options for resolution
 * @returns {Promise<Object>} Transformed item with mapped fields
 */
export async function applyMapTransform(backend, item, mapConfig, options = {}) {
  if (!mapConfig || typeof mapConfig !== 'object') {
    return item; // No map config, return item as-is
  }

  // First, resolve any co-id references in the item (e.g., source, target)
  // This ensures expressions like $item.source.role can access the resolved object
  const { timeoutMs = 2000 } = options;
  
  // Resolve co-id references in the item (for fields that might be referenced in map expressions)
  // CRITICAL: We need deep recursive resolution to resolve nested co-ids at any depth
  // Increase maxDepth to ensure nested properties are fully resolved
  let resolvedItem = item;
  try {
    // Resolve all co-id references in the item with deep recursion
    // This ensures that any co-id at any level gets resolved before mapping
    resolvedItem = await resolveCoValueReferences(backend, item, {
      fields: null, // Resolve all co-id fields
      timeoutMs: timeoutMs || 5000 // Increase timeout for deep resolution
    }, new Set(), 20, 0); // Increase maxDepth to 20 for deep nested resolution
  } catch (err) {
    // If resolution fails, use original item
    console.warn(`[applyMapTransform] Failed to resolve references:`, err);
    resolvedItem = item;
  }

  // Create evaluator for MaiaScript expressions
  // Import dynamically to avoid circular dependencies
  const { Evaluator } = await import('@MaiaOS/script/utils/evaluator.js');
  const evaluator = new Evaluator();

  // Build data context for expression evaluation
  // In map context, $$ (double dollar) refers to the current item
  // Expressions like "$$source.role" will access item.source.role
  const data = {
    context: {}, // No context needed for map transformations
    item: resolvedItem // The resolved item is available via $$ shortcut
  };

  // Apply each mapping
  const mappedItem = { ...resolvedItem }; // Start with resolved item
  const coIdsToRemove = new Set(); // Track co-ids used for mapping

  for (const [targetField, expression] of Object.entries(mapConfig)) {
    try {
      // STRICT SYNTAX: Expressions MUST use $$ prefix for item properties
      // This ensures consistency with MaiaScript expression syntax across the codebase
      if (typeof expression !== 'string' || !expression.startsWith('$$')) {
        throw new Error(`Map expression for "${targetField}" must use strict $$ syntax. Got: "${expression}". Expected format: "$$property.path"`);
      }
      
      const processedExpression = expression; // Use expression as-is (already has $$ prefix)
      
      // Track which co-ids are used in expressions (for removal after mapping)
      // Extract the root property from the expression path (e.g., "source" from "$$source.role")
      // We remove these keys because they were co-ids that have been resolved and mapped to new properties
      // This works for ANY property path - fully generic, no hardcoded property names
      const rootProperty = expression.substring(2).split('.')[0]; // Remove $$ prefix (strict syntax)
      if (rootProperty && rootProperty in item) {
        // Check if this was originally a co-id (before resolution)
        // If it was a co-id string, we'll remove it after mapping since the mapped properties replace it
        const originalValue = item[rootProperty];
        if (originalValue && typeof originalValue === 'string' && originalValue.startsWith('co_z')) {
          coIdsToRemove.add(rootProperty);
        }
      }
      
      // Evaluate the expression (e.g., "$$source.role" or "$$nested.deep.property")
      // Fully generic - works for ANY property path, not just specific properties
      let mappedValue;
      try {
        // Evaluate using the MaiaScript evaluator
        mappedValue = await evaluator.evaluate(processedExpression, data);
        
        // If evaluator returns undefined, try direct property access as fallback
        // This handles cases where the evaluator might not support certain syntax
        if (mappedValue === undefined) {
          const propertyPath = expression.substring(2); // Remove $$ prefix (strict syntax)
          const pathParts = propertyPath.split('.');
          
          // Traverse the path to get the value
          let directValue = resolvedItem;
          for (const part of pathParts) {
            if (directValue && typeof directValue === 'object' && part in directValue) {
              directValue = directValue[part];
            } else {
              directValue = undefined;
              break;
            }
          }
          
          if (directValue !== undefined) {
            console.warn(`[applyMapTransform] ⚠️ Evaluator returned undefined, using direct access for "${targetField}" = "${expression}"`);
            mappedValue = directValue;
          }
        }
        
        mappedItem[targetField] = mappedValue;
      } catch (evalErr) {
        // If evaluation fails, try direct property access as fallback
        const propertyPath = expression.substring(2); // Remove $$ prefix (strict syntax)
        const pathParts = propertyPath.split('.');
        
        // Traverse the path to get the value
        let directValue = resolvedItem;
        for (const part of pathParts) {
          if (directValue && typeof directValue === 'object' && part in directValue) {
            directValue = directValue[part];
          } else {
            directValue = undefined;
            break;
          }
        }
        
        console.warn(`[applyMapTransform] ⚠️ Evaluation failed for "${targetField}" = "${expression}":`, {
          error: evalErr.message,
          processedExpression,
          propertyPath,
          directValue,
          resolvedItemKeys: Object.keys(resolvedItem)
        });
        
        // Use direct access as fallback if available
        mappedItem[targetField] = directValue !== undefined ? directValue : undefined;
      }
    } catch (err) {
      console.warn(`[applyMapTransform] Failed to evaluate expression "${expression}" for field "${targetField}":`, err);
      console.warn(`[applyMapTransform] Resolved item keys:`, Object.keys(resolvedItem));
      // If evaluation fails, set to undefined or keep original
      mappedItem[targetField] = undefined;
    }
  }

  // Remove co-ids used for mapping (any property that was originally a co-id and got mapped)
  // Fully generic - removes ANY co-id property that was referenced in map expressions
  for (const coIdKey of coIdsToRemove) {
    delete mappedItem[coIdKey];
  }

  return mappedItem;
}

/**
 * Apply map transformation to an array of items
 * @param {Object} backend - Backend instance
 * @param {Array} items - Array of items to transform
 * @param {Object} mapConfig - Map configuration object
 * @param {Object} options - Options for resolution
 * @returns {Promise<Array>} Array of transformed items
 */
export async function applyMapTransformToArray(backend, items, mapConfig, options = {}) {
  if (!Array.isArray(items)) {
    return items;
  }

  // Apply map transform to each item in parallel
  return Promise.all(
    items.map(item => applyMapTransform(backend, item, mapConfig, options))
  );
}
