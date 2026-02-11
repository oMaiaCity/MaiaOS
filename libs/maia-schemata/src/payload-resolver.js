/**
 * Universal Payload Resolution Interface
 *
 * DOM markers (view layer) - @inputValue, @dataColumn
 * MaiaScript expressions: Use resolveExpressions from expression-resolver directly
 */

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
      // When event target is a button, element.value is empty - use form's/container's first input
      let inputEl = element;
      if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
        const formOrContainer = element.closest('form') || element.closest('[class*="form"]') || element.parentElement;
        inputEl = formOrContainer?.querySelector('input, textarea') ?? element;
      }
      result[key] = (inputEl?.value ?? '') || '';
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
