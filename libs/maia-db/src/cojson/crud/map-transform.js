/**
 * Map Transform - Apply mapping transformations to read data
 * 
 * Supports MaiaScript expressions in map definitions to transform data during read operations.
 * Example:
 * {
 *   "op": "read",
 *   "schema": "@schema/message",
 *   "map": {
 *     "sender": "$$source.role",
 *     "recipient": "$$target.role"
 *   }
 * }
 * 
 * Note: Expressions use $$ (double dollar) for item access, not $item
 * - $$source.role → accesses item.source.role
 * - $$target.id → accesses item.target.id
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
  // We'll resolve all co-id strings in the item to make them accessible
  let resolvedItem = item;
  try {
    // Resolve all co-id references in the item
    resolvedItem = await resolveCoValueReferences(backend, item, {
      fields: null, // Resolve all co-id fields
      timeoutMs
    }, new Set(), 10, 0);
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

  for (const [targetField, expression] of Object.entries(mapConfig)) {
    try {
      // Evaluate the expression (e.g., "$$source.role")
      // $$source.role → evaluates to item.source.role
      const mappedValue = await evaluator.evaluate(expression, data);
      mappedItem[targetField] = mappedValue;
      console.log(`[applyMapTransform] Mapped "${targetField}" = "${expression}" →`, mappedValue);
    } catch (err) {
      console.warn(`[applyMapTransform] Failed to evaluate expression "${expression}" for field "${targetField}":`, err);
      // If evaluation fails, set to undefined or keep original
      mappedItem[targetField] = undefined;
    }
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
