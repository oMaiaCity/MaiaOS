/**
 * Filter Helpers
 * 
 * Provides helpers for filtering CoValue data and extracting data from content.
 */

/**
 * Extract CoValue data from RawCoValue content
 * @param {RawCoValue} content - RawCoValue content
 * @returns {Object} Extracted data
 */
export function extractCoValueDataFromContent(content) {
  if (!content) return null;

  const rawType = content.type || 'unknown';
  const properties = {};

  if (content.get && typeof content.get === 'function') {
    // CoMap object - use .keys() method
    const keys = content.keys && typeof content.keys === 'function' 
      ? content.keys() 
      : Object.keys(content);
    for (const key of keys) {
      properties[key] = content.get(key);
    }
  } else {
    // Plain object - use Object.keys()
    const keys = Object.keys(content);
    for (const key of keys) {
      properties[key] = content[key];
    }
  }

  let items = null;
  if (rawType === 'colist' && content.toJSON) {
    try {
      items = content.toJSON();
    } catch (e) {
      // Ignore
    }
  }

  return {
    id: content.id,
    type: rawType,
    properties: properties,
    items: items,
    content: content
  };
}

/**
 * Check if CoValue data matches filter criteria
 * @param {Object|Array} data - CoValue data (object for CoMap, array for CoList)
 * @param {Object} filter - Filter criteria
 * @returns {boolean} True if matches filter
 */
export function matchesFilter(data, filter) {
  // For arrays (CoList), filter applies to items
  if (Array.isArray(data)) {
    return data.some(item => {
      for (const [key, value] of Object.entries(filter)) {
        // Use strict equality check (handles boolean, null, undefined correctly)
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  // For objects (CoMap), filter applies to properties
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(filter)) {
      // Use strict equality check (handles boolean, null, undefined correctly)
      // This ensures {done: false} matches items where done === false (not just falsy)
      if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  return false;
}
