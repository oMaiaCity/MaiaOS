/**
 * Data Extraction Functions
 * 
 * Provides functions for extracting CoValue data in normalized and flat formats.
 */

/**
 * Extract CoValue data from CoValueCore and normalize (match IndexedDB format)
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @meta-schema)
 * @returns {Object} Normalized CoValue data (flattened properties, id field added)
 */
export function extractCoValueData(backend, coValueCore, schemaHint = null) {
  const content = backend.getCurrentContent(coValueCore);
  const header = backend.getHeader(coValueCore);
  const headerMeta = header?.meta || null;
  const ruleset = coValueCore.ruleset || header?.ruleset;
  
  const rawType = content?.type || 'unknown';
  
  // Determine schema based on hint or headerMeta
  let schema = headerMeta?.$schema || null;
  
  // Handle special types that don't have $schema
  if (schemaHint === '@group' || (ruleset && ruleset.type === 'group')) {
    schema = '@group'; // Groups don't have $schema, use special marker
  } else if (schemaHint === '@account' || (headerMeta && headerMeta.type === 'account')) {
    schema = '@account'; // Accounts don't have $schema, use special marker
  } else if (schemaHint === '@meta-schema' || schema === 'GenesisSchema') {
    schema = '@meta-schema'; // Meta schema uses special marker
  }

  // Normalize based on type
  if (rawType === 'colist' && content && content.toJSON) {
    // CoList: The list IS the content - return items directly (no properties, CoLists don't have custom properties)
    try {
      const items = content.toJSON();
      return {
        id: coValueCore.id,
        $schema: schema, // Use $schema for consistency with headerMeta.$schema
        type: 'colist',
        items: items, // Items ARE the CoList content (not a property)
        // No properties array - CoLists don't have custom key-value properties, only items
      };
    } catch (e) {
      return {
        id: coValueCore.id,
        $schema: schema, // Use $schema for consistency with headerMeta.$schema
        type: 'colist',
        items: []
      };
    }
  } else if (rawType === 'costream' && content) {
    // CoStream: The stream IS the content - return items directly (no properties, CoStreams don't have custom properties)
    // CoStreams have a session-based structure: { session_id: [items...] }
    // Use toJSON() to get the session structure, then flatten all sessions into a single array
    try {
      const streamData = content.toJSON();
      const items = [];
      
      if (streamData && typeof streamData === 'object' && !(streamData instanceof Uint8Array)) {
        // Flatten all sessions into single array
        for (const sessionKey in streamData) {
          if (Array.isArray(streamData[sessionKey])) {
            items.push(...streamData[sessionKey]);
          }
        }
      }
      
      // Essential debug: Log CoStream reading (always log for debugging)
      console.log(`[CoJSONBackend] 📥 Read CoStream ${coValueCore.id} (${items.length} items)`);
      if (items.length > 0) {
        console.log(`[CoJSONBackend]   First item:`, JSON.stringify(items[0]).substring(0, 100));
      } else {
        // Log stream structure when empty to diagnose
        console.log(`[CoJSONBackend]   Stream data type:`, typeof streamData, streamData instanceof Uint8Array ? 'Uint8Array' : 'object');
        if (streamData && typeof streamData === 'object' && !(streamData instanceof Uint8Array)) {
          console.log(`[CoJSONBackend]   Session keys:`, Object.keys(streamData));
          console.log(`[CoJSONBackend]   Session counts:`, Object.fromEntries(Object.entries(streamData).map(([k, v]) => [k, Array.isArray(v) ? v.length : 'not array'])));
        }
      }
      
      return {
        id: coValueCore.id,
        schema: schema,
        type: 'costream',
        items: items, // Items ARE the CoStream content (not a property)
        // No properties array - CoStreams don't have custom key-value properties, only items
      };
    } catch (e) {
      console.error(`[CoJSONBackend] ❌ Error reading CoStream ${coValueCore.id.substring(0, 12)}...:`, e);
      return {
        id: coValueCore.id,
        $schema: schema, // Use $schema for consistency with headerMeta.$schema
        type: 'costream',
        items: []
      };
    }
  } else if (content && content.get && typeof content.get === 'function') {
    // CoMap: format properties as array for DB viewer (with key, value, type)
    const accountType = headerMeta?.type || null;  // Preserve account type from headerMeta
    
    const normalized = {
      id: coValueCore.id,  // Always add id field (derived from co-id)
      $schema: schema,  // Use $schema for consistency with headerMeta.$schema
      type: rawType,  // Add type for DB viewer
      displayName: accountType === 'account' ? 'Account' : (schema || 'CoMap'),  // Display name for DB viewer
      properties: []  // Properties array for DB viewer
    };
    
    // Preserve headerMeta.type for account CoMaps
    if (accountType) {
      normalized.headerMeta = { type: accountType };
    }

    // Extract properties as array (format expected by DB viewer)
    // Handle both CoMap objects (with .keys() method) and plain objects
    const keys = content.keys && typeof content.keys === 'function' 
      ? content.keys() 
      : Object.keys(content);
    for (const key of keys) {
      try {
        const value = content.get && typeof content.get === 'function'
          ? content.get(key)
          : content[key];
        let type = typeof value;
        let displayValue = value;
        
        // Detect co-id references
        if (typeof value === 'string' && value.startsWith('co_')) {
          type = 'co-id';
        } else if (typeof value === 'string' && value.startsWith('key_')) {
          type = 'key';
        } else if (typeof value === 'string' && value.startsWith('sealed_')) {
          type = 'sealed';
          displayValue = 'sealed_***';
        } else if (value === null) {
          type = 'null';
        } else if (value === undefined) {
          type = 'undefined';
        } else if (typeof value === 'object' && value !== null) {
          type = 'object';
          displayValue = JSON.stringify(value);
        } else if (Array.isArray(value)) {
          type = 'array';
          displayValue = JSON.stringify(value);
        }
        
        normalized.properties.push({
          key: key,
          value: displayValue,
          type: type
        });
      } catch (e) {
        normalized.properties.push({
          key: key,
          value: `<error: ${e.message}>`,
          type: 'error'
        });
      }
    }

    return normalized;
  }

  // Fallback for other types
  return {
    id: coValueCore.id,
    type: rawType,
    $schema: schema,
    headerMeta: headerMeta
  };
}

/**
 * Extract CoValue data as flat object (for SubscriptionEngine and UI)
 * Returns flat objects like {id: '...', text: '...', done: false} instead of normalized format
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @param {string} [schemaHint] - Schema hint for special types
 * @returns {Object|Array} Flat object or array of items
 */
export function extractCoValueDataFlat(backend, coValueCore, schemaHint = null) {
  // Special handling for accounts - use backend.account directly if it matches
  const header = backend.getHeader(coValueCore);
  const headerMeta = header?.meta || null;
  const ruleset = coValueCore.ruleset || header?.ruleset;
  
  // Detect account: schemaHint is '@account' OR headerMeta.type === 'account' OR it matches backend.account
  const isAccount = schemaHint === '@account' || 
                   (headerMeta && headerMeta.type === 'account') ||
                   (backend.account && backend.account.id === coValueCore.id);
  
  if (isAccount && backend.account && backend.account.id === coValueCore.id) {
    // Use the account object directly (it's a RawAccount/RawCoMap)
    // This ensures we get the actual account properties even if CoValueCore isn't fully synced
    const header = backend.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const schema = headerMeta?.$schema || null;
    const result = { 
      id: backend.account.id,
      type: 'comap', // Accounts are CoMaps
      $schema: schema // Include $schema for metadata lookup
    };
    try {
      const keys = backend.account.keys && typeof backend.account.keys === 'function' 
        ? backend.account.keys() 
        : Object.keys(backend.account);
      for (const key of keys) {
        try {
          result[key] = backend.account.get(key);
        } catch (e) {
          // Skip keys that can't be read
          console.warn(`[CoJSONBackend] Failed to read account key ${key}:`, e);
        }
      }
    } catch (e) {
      console.warn(`[CoJSONBackend] Failed to extract account keys:`, e);
    }
    return result;
  }
  
  const content = backend.getCurrentContent(coValueCore);
  if (!content) {
    // If content is not available but it's an account, try using backend.account as fallback
    if (isAccount && backend.account && backend.account.id === coValueCore.id) {
      const header = backend.getHeader(coValueCore);
      const headerMeta = header?.meta || null;
      const schema = headerMeta?.$schema || null;
      const result = { 
        id: backend.account.id,
        type: 'comap',
        $schema: schema
      };
      try {
        const keys = backend.account.keys && typeof backend.account.keys === 'function' 
          ? backend.account.keys() 
          : Object.keys(backend.account);
        for (const key of keys) {
          result[key] = backend.account.get(key);
        }
      } catch (e) {
        // Ignore errors
      }
      return result;
    }
    const header = backend.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const schema = headerMeta?.$schema || null;
    return { 
      id: coValueCore.id,
      type: 'unknown',
      $schema: schema
    };
  }
  
  const rawType = content?.type || 'unknown';
  
  // Determine schema from headerMeta
  const schema = headerMeta?.$schema || null;
  
  // CoList: return object with type and items array
  if (rawType === 'colist' && content && content.toJSON) {
    try {
      const items = content.toJSON();
      return {
        id: coValueCore.id,
        type: 'colist',
        $schema: schema,
        items: items
      };
    } catch (e) {
      return {
        id: coValueCore.id,
        type: 'colist',
        $schema: schema,
        items: []
      };
    }
  }
  
  // CoStream: return object with type and items array
  if (rawType === 'costream' && content) {
    try {
      const streamData = content.toJSON();
      const items = [];
      
      if (streamData && typeof streamData === 'object' && !(streamData instanceof Uint8Array)) {
        // Flatten all sessions into single array
        for (const sessionKey in streamData) {
          if (Array.isArray(streamData[sessionKey])) {
            items.push(...streamData[sessionKey]);
          }
        }
      }
      
      return {
        id: coValueCore.id,
        type: 'costream',
        $schema: schema,
        items: items
      };
    } catch (e) {
      console.error(`[CoJSONBackend] Error extracting CoStream ${coValueCore.id.substring(0, 12)}...:`, e);
      return {
        id: coValueCore.id,
        type: 'costream',
        $schema: schema,
        items: []
      };
    }
  }
  
  // CoMap: return flat object with properties directly accessible, including type and $schema
  if (content && content.get && typeof content.get === 'function') {
    const result = { 
      id: coValueCore.id,
      type: rawType === 'comap' ? 'comap' : rawType, // Ensure type is set
      $schema: schema // Include $schema for metadata lookup
    };
    const keys = content.keys && typeof content.keys === 'function' 
      ? content.keys() 
      : Object.keys(content);
    for (const key of keys) {
      result[key] = content.get(key);
    }
    return result;
  }
  
  // Fallback
  return { 
    id: coValueCore.id,
    type: rawType,
    $schema: schema
  };
}
