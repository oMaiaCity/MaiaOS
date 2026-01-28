/**
 * Universal Expression Resolver
 * 
 * ONE universal function for resolving MaiaScript expressions in payloads.
 * Used by View Engine, State Engine, and Operations to eliminate duplication.
 * 
 * Handles:
 * - MaiaScript expressions: $key (context), $$key (item)
 * - DSL operations: $if, $eq, $not, $and, $or, etc.
 * - Recursive resolution: Arrays, objects, nested structures
 * 
 * DOM markers (@inputValue, @dataColumn) are handled separately by View Engine.
 * 
 * @param {any} payload - The payload to resolve (may contain expressions)
 * @param {Object} evaluator - Evaluator instance with evaluate() and isDSLOperation() methods
 * @param {Object} data - The data context { context, item }
 * @returns {Promise<any>} Fully resolved payload with all expressions evaluated
 */
export async function resolveExpressions(payload, evaluator, data) {
  // Handle primitives (pass through)
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }

  // Handle arrays - recursively resolve each element
  if (Array.isArray(payload)) {
    return Promise.all(payload.map(item => resolveExpressions(item, evaluator, data)));
  }

  // Handle objects
  const keys = Object.keys(payload);
  
  // Check if this entire object is a DSL operation (like { $if: {...} })
  // DSL operations have a single key starting with $ and should be evaluated directly
  if (keys.length === 1 && keys[0].startsWith('$')) {
    return await evaluator.evaluate(payload, data);
  }

  // Handle regular objects - recursively resolve all properties
  const resolved = {};
  for (const [key, value] of Object.entries(payload)) {
    // If value is an object or array, check if it's a DSL operation first
    if (value && typeof value === 'object') {
      if (evaluator.isDSLOperation(value)) {
        // Evaluate DSL operation directly
        resolved[key] = await evaluator.evaluate(value, data);
      } else {
        // Otherwise, recursively resolve it
        resolved[key] = await resolveExpressions(value, evaluator, data);
      }
    } else {
      // Evaluate as MaiaScript expression (handles $key, $$key shortcuts)
      resolved[key] = await evaluator.evaluate(value, data);
    }
  }

  return resolved;
}
