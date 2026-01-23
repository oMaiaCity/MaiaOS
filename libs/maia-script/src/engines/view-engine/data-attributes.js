/**
 * Data Attributes Module
 * 
 * Handles data-attribute resolution from data specifications.
 */

import { sanitizeAttribute, containsDangerousHTML } from '../../utils/html-sanitizer.js';

/**
 * Convert camelCase to kebab-case
 * @param {string} str - camelCase string
 * @returns {string} kebab-case string
 */
export function toKebabCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Resolve data-attributes from data spec
 * @param {Object} viewEngine - ViewEngine instance
 * @param {string|Object} dataSpec - Data specification: "$contextKey" or { "key": "$value" }
 * @param {Object} data - The data context { context, item }
 * @param {HTMLElement} element - The element to set attributes on
 */
export async function resolveDataAttributes(viewEngine, dataSpec, data, element) {
  if (typeof dataSpec === 'string') {
    // String shorthand: "data": "$dragOverColumn"
    // Special case: if it's an object path like "$draggedItemIds.$$id", resolve item lookup
    if (dataSpec.includes('.$$')) {
      // Item lookup syntax: "$draggedItemIds.$$id" -> looks up draggedItemIds[item.id]
      const [contextKey, itemKey] = dataSpec.split('.');
      const contextObj = await viewEngine.evaluator.evaluate(contextKey, data);
      const itemId = await viewEngine.evaluator.evaluate(itemKey, data);
      
      if (contextObj && typeof contextObj === 'object' && itemId) {
        const value = contextObj[itemId];
        if (value !== null && value !== undefined) {
          // Extract key name from context key (remove $)
          const key = contextKey.substring(1);
          const attrName = `data-${toKebabCase(key)}`;
          element.setAttribute(attrName, String(value));
        }
      }
    } else {
      // Regular context value
      const value = await viewEngine.evaluator.evaluate(dataSpec, data);
      if (value !== null && value !== undefined) {
        // Extract key name from context key (remove $ or $$)
        const key = dataSpec.startsWith('$$') 
          ? dataSpec.substring(2) // Remove $$
          : dataSpec.substring(1); // Remove $
        const attrName = `data-${toKebabCase(key)}`;
        element.setAttribute(attrName, String(value));
      }
    }
  } else if (typeof dataSpec === 'object' && dataSpec !== null) {
    // Object syntax: "data": { "dragOver": "$dragOverColumn", "itemId": "$draggedItemId" }
    // Special case: if value is an object with $eq, compare context value with item value
    for (const [key, valueSpec] of Object.entries(dataSpec)) {
      let value;
      
      // Check if this is a comparison: { "isDragged": { "$eq": ["$draggedItemId", "$$id"] } }
      if (typeof valueSpec === 'object' && valueSpec !== null && valueSpec.$eq) {
        // This is a comparison - evaluate it
        const comparisonResult = await viewEngine.evaluator.evaluate(valueSpec, data);
        value = comparisonResult ? 'true' : null; // Set to 'true' if match, null if no match
      } else if (typeof valueSpec === 'string' && valueSpec.includes('.$$')) {
        // Item lookup syntax: "$draggedItemIds.$$id"
        const [contextKey, itemKey] = valueSpec.split('.');
        const contextObj = await viewEngine.evaluator.evaluate(contextKey, data);
        const itemId = await viewEngine.evaluator.evaluate(itemKey, data);
        
        if (contextObj && typeof contextObj === 'object' && itemId) {
          value = contextObj[itemId];
        }
      } else {
        // Regular value evaluation
        value = await viewEngine.evaluator.evaluate(valueSpec, data);
      }
      
      if (value !== null && value !== undefined) {
        const attrName = `data-${toKebabCase(key)}`;
        element.setAttribute(attrName, String(value));
      }
    }
  }
}
