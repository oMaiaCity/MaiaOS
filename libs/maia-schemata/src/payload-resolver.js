/**
 * Universal Payload Resolution Interface
 * 
 * ONE interface for resolving payloads in two stages:
 * 1. DOM markers (view layer) - @inputValue, @dataColumn
 * 2. MaiaScript expressions (state machine) - $context, $$item, $$result, DSL operations
 * 
 * This eliminates dual resolution - View extracts DOM, State resolves MaiaScript
 */

import { resolveExpressions } from './expression-resolver.js';

/**
 * Extract DOM marker values ONLY (view layer)
 * Preserves all MaiaScript expressions ($, $$, DSL) for state machine to resolve
 * 
 * @param {any} payload - The payload to process
 * @param {HTMLElement} element - The DOM element (for @inputValue, @dataColumn)
 * @returns {any} Payload with DOM values extracted, MaiaScript expressions preserved
 */
export function extractDOMValues(payload, element) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  // Handle arrays - recursively process each element
  if (Array.isArray(payload)) {
    return payload.map(item => extractDOMValues(item, element));
  }

  // Handle objects - extract DOM markers only
  const result = {};
  for (const [key, value] of Object.entries(payload)) {
    // Handle special @inputValue marker (DOM-specific)
    if (value === '@inputValue') {
      result[key] = element.value || '';
    }
    // Handle special @dataColumn marker (DOM-specific, extracts data-column attribute)
    else if (value === '@dataColumn') {
      result[key] = element.dataset.column || element.getAttribute('data-column') || null;
    }
    // Handle nested objects/arrays - recursively extract DOM markers
    else if (typeof value === 'object' && value !== null) {
      result[key] = extractDOMValues(value, element);
    }
    // Keep as-is (including MaiaScript expressions like $context, $$id, DSL operations)
    else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Resolve MaiaScript expressions ONLY (state machine)
 * Handles $context, $$item, $$result, DSL operations
 * 
 * @param {any} payload - The payload to resolve (may contain MaiaScript expressions)
 * @param {Object} evaluator - Evaluator instance with evaluate() and isDSLOperation() methods
 * @param {Object} context - Actor context (for $context resolution)
 * @param {Object} item - Event payload (for $$item resolution)
 * @param {any} result - Last tool result (for $$result resolution)
 * @returns {Promise<any>} Fully resolved payload with all MaiaScript expressions evaluated
 */
export async function resolveMaiaScript(payload, evaluator, context, item, result = null) {
  // Build data context for expression resolver
  const data = {
    context,
    item: item || {},
    result: result || null
  };

  // Use universal expression resolver (handles $, $$, DSL operations)
  return await resolveExpressions(payload, evaluator, data);
}
