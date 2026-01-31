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
 * Recursively parse JSON strings within an object/array
 * Handles cases where nested objects are stored as JSON strings in CoJSON
 * @param {any} data - Data to parse (object, array, or primitive)
 * @returns {any} Data with JSON strings parsed recursively
 */
function parseNestedJsonStrings(data) {
  if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
    try {
      const parsed = JSON.parse(data);
      // Recursively parse nested JSON strings
      return parseNestedJsonStrings(parsed);
    } catch (e) {
      return data; // Keep as string if not valid JSON
    }
  } else if (Array.isArray(data)) {
    return data.map(item => parseNestedJsonStrings(item));
  } else if (typeof data === 'object' && data !== null) {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
      // CRITICAL: Recursively parse each value - this handles cases where
      // nested properties like 'options' are stored as JSON strings
      result[key] = parseNestedJsonStrings(val);
    }
    return result;
  }
  return data; // Primitives (numbers, booleans, null) pass through
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
    // Check if this is a schema co-value (schemas shouldn't have 'id' or 'type' fields)
    // Schemas are identified by: headerMeta.$schema === 'GenesisSchema' OR content has schema-like properties
    // Schemas use 'cotype' for CoJSON types, not 'type' (which AJV expects to be JSON Schema types)
    const hasCotype = content.get('cotype');
    const hasTitle = content.get('title');
    const hasProperties = content.get('properties');
    const hasItems = content.get('items');
    const isSchema = schema === 'GenesisSchema' || 
                     (hasCotype || hasTitle || hasProperties || hasItems);
    
    const result = { 
      // Only include 'id' and 'type' for non-schema co-values
      // Schemas are content-addressable by co-ID and use 'cotype', not 'type'
      ...(isSchema ? {} : { 
        id: coValueCore.id,
        type: rawType === 'comap' ? 'comap' : rawType
      }),
      $schema: schema // Include $schema for metadata lookup
    };
    const keys = content.keys && typeof content.keys === 'function' 
      ? content.keys() 
      : Object.keys(content);
    for (const key of keys) {
      let value = content.get(key);
      
      // Debug: Log raw value for context objects (to diagnose options.map issue)
      if (key === 'allMessages' || (schema && schema.includes('context'))) {
        console.log(`[extractCoValueDataFlat] 🔍 Raw value for key "${key}":`, {
          type: typeof value,
          isString: typeof value === 'string',
          isObject: typeof value === 'object' && value !== null,
          startsWithBrace: typeof value === 'string' && value.startsWith('{'),
          valueSample: typeof value === 'string' ? value.substring(0, 200) : (typeof value === 'object' ? JSON.stringify(value).substring(0, 200) : value),
          hasOptions: typeof value === 'object' && value !== null ? 'options' in value : false,
          optionsType: typeof value === 'object' && value !== null && 'options' in value ? typeof value.options : 'N/A'
        });
      }
      
      // CRITICAL: CoJSON might serialize nested objects as JSON strings
      // Parse JSON strings back to objects (especially for nested structures like states, query options)
      // Skip JSON parsing for certain fields that should always be plain strings (like error messages)
      const skipJsonParsingFields = ['error', 'message', 'content'];
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('[')) && !skipJsonParsingFields.includes(key)) {
        try {
          const parsed = JSON.parse(value);
          console.log(`[extractCoValueDataFlat] ✅ Parsed JSON string for "${key}":`, {
            parsedType: typeof parsed,
            parsedKeys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [],
            hasOptions: typeof parsed === 'object' && parsed !== null ? 'options' in parsed : false,
            optionsType: typeof parsed === 'object' && parsed !== null && 'options' in parsed ? typeof parsed.options : 'N/A',
            parsedSample: JSON.stringify(parsed).substring(0, 300)
          });
          // CRITICAL: Recursively parse nested JSON strings within the parsed object
          // This handles cases where nested objects like options.map are also stored as JSON strings
          value = parseNestedJsonStrings(parsed);
          console.log(`[extractCoValueDataFlat] ✅ After recursive parse for "${key}":`, {
            finalType: typeof value,
            finalKeys: typeof value === 'object' && value !== null ? Object.keys(value) : [],
            hasOptions: typeof value === 'object' && value !== null ? 'options' in value : false,
            optionsKeys: typeof value === 'object' && value !== null && 'options' in value && typeof value.options === 'object' ? Object.keys(value.options) : [],
            hasMap: typeof value === 'object' && value !== null && 'options' in value && typeof value.options === 'object' ? 'map' in value.options : false,
            finalSample: JSON.stringify(value).substring(0, 400)
          });
        } catch (e) {
          console.warn(`[extractCoValueDataFlat] Failed to parse JSON string for "${key}":`, e);
          // Keep as string if not valid JSON
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Also check if object properties are JSON strings (for nested structures)
        // CRITICAL: Check if 'options' property is a JSON string that needs parsing
        if (key === 'allMessages' || (schema && schema.includes('context'))) {
          const hasOptionsBefore = 'options' in value;
          const optionsTypeBefore = hasOptionsBefore ? typeof value.options : 'N/A';
          const optionsIsString = hasOptionsBefore && typeof value.options === 'string' && (value.options.startsWith('{') || value.options.startsWith('['));
          
          console.log(`[extractCoValueDataFlat] 🔍 Before recursive parse for "${key}":`, {
            hasOptions: hasOptionsBefore,
            optionsType: optionsTypeBefore,
            optionsIsString,
            optionsValue: hasOptionsBefore ? (typeof value.options === 'string' ? value.options.substring(0, 200) : JSON.stringify(value.options).substring(0, 200)) : 'N/A',
            allKeys: Object.keys(value)
          });
        }
        
        const beforeParse = JSON.stringify(value).substring(0, 200);
        value = parseNestedJsonStrings(value);
        const afterParse = JSON.stringify(value).substring(0, 200);
        
        if (key === 'allMessages' || (schema && schema.includes('context'))) {
          const hasOptionsAfter = 'options' in value;
          const optionsTypeAfter = hasOptionsAfter ? typeof value.options : 'N/A';
          const hasMap = hasOptionsAfter && typeof value.options === 'object' && value.options !== null ? 'map' in value.options : false;
          
          console.log(`[extractCoValueDataFlat] ✅ After recursive parse for "${key}":`, {
            hasOptions: hasOptionsAfter,
            optionsType: optionsTypeAfter,
            hasMap,
            optionsKeys: hasOptionsAfter && typeof value.options === 'object' && value.options !== null ? Object.keys(value.options) : [],
            mapKeys: hasMap ? Object.keys(value.options.map) : [],
            changed: beforeParse !== afterParse,
            finalSample: JSON.stringify(value).substring(0, 400)
          });
        }
      }
      result[key] = value;
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

/**
 * Resolve CoValue references in data object
 * Replaces co-id strings with resolved CoValue objects based on configuration
 * @param {Object} backend - Backend instance
 * @param {any} data - Data object to process (may contain co-id references)
 * @param {Object} options - Resolution options
 * @param {string[]} [options.fields] - Specific field names to resolve (e.g., ['source', 'target']). If not provided, resolves all co-id references
 * @param {string[]} [options.schemas] - Specific schema co-ids to resolve. If not provided, resolves all CoValues
 * @param {Set<string>} visited - Set of already visited co-ids (prevents circular references)
 * @param {number} maxDepth - Maximum recursion depth
 * @param {number} currentDepth - Current recursion depth
 * @returns {Promise<any>} Data object with CoValue references resolved
 */
export async function resolveCoValueReferences(backend, data, options = {}, visited = new Set(), maxDepth = 10, currentDepth = 0) {
  const { fields = null, schemas = null, timeoutMs = 2000 } = options;
  
  if (currentDepth > maxDepth) {
    return data; // Prevent infinite recursion
  }
  
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }
  
    // Handle primitives (strings, numbers, booleans)
    if (typeof data !== 'object') {
      // Check if it's a co-id string that should be resolved
      if (typeof data === 'string' && data.startsWith('co_z')) {
        // CRITICAL: Pass maxDepth and currentDepth to ensure recursive resolution works
        const resolved = await resolveCoId(backend, data, options, visited, maxDepth, currentDepth);
        // resolveCoId always returns an object now, so return it directly
        return resolved;
      }
      return data;
    }
  
  // Handle arrays - process each item
  if (Array.isArray(data)) {
    return Promise.all(data.map(item => 
      resolveCoValueReferences(backend, item, options, visited, maxDepth, currentDepth + 1)
    ));
  }
  
  // Handle objects
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    // Always preserve internal properties (don't skip them - they're part of the data)
    // CRITICAL: Preserve ALL properties, including id, $schema, type, etc.
    // Skip resolution for internal properties (they're not co-ids to resolve)
    if (key === 'id' || key === '$schema' || key === 'type' || key === 'loading' || key === 'error') {
      result[key] = value;
      continue;
    }
    
    // Check if this field should be resolved
    const shouldResolve = fields === null || fields.includes(key);
    
    // Handle null/undefined - keep as-is (don't try to resolve)
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }
    
    if (shouldResolve && typeof value === 'string' && value.startsWith('co_z')) {
      // Resolve this co-id reference (with depth tracking for recursion)
      const resolved = await resolveCoId(backend, value, { ...options, timeoutMs, maxDepth, currentDepth }, visited, maxDepth, currentDepth + 1);
      result[key] = resolved;
    } else {
      // Recursively process nested values (preserves non-co-id values like strings, numbers, etc.)
      result[key] = await resolveCoValueReferences(backend, value, options, visited, maxDepth, currentDepth + 1);
    }
  }
  
  // CRITICAL: Ensure we preserve ALL properties from the original data object
  // This is especially important for actor objects where properties like 'role' must be preserved
  return result;
}

/**
 * Resolve a single co-id to its CoValue data using the universal resolver
 * Uses the same read() API as all other co-id resolution in the codebase
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-id to resolve
 * @param {Object} options - Resolution options
 * @param {string[]} [options.schemas] - Specific schema co-ids to resolve
 * @param {number} [options.timeoutMs=2000] - Timeout for waiting for CoValue to be available
 * @param {Set<string>} visited - Set of already visited co-ids
 * @returns {Promise<any>} Resolved CoValue data or original co-id if not resolved
 */
async function resolveCoId(backend, coId, options = {}, visited = new Set(), maxDepth = 10, currentDepth = 0) {
  const { schemas = null, timeoutMs = 2000 } = options;
  
  // CRITICAL: Check visited set first to prevent circular references within this resolution pass
  if (visited.has(coId)) {
    return { id: coId }; // Already processing this co-id, return object with id to prevent circular reference
  }
  
  // CRITICAL OPTIMIZATION: Check cache BEFORE calling backend.read() to prevent expensive re-resolution
  // Use the same cache key format as read.js so we can reuse cached resolved data
  const cache = backend.subscriptionCache;
  const cacheOptions = {
    deepResolve: false, // We don't need deep resolution here
    resolveReferences: options, // Use the same resolution options
    map: null, // No map transform in resolveCoId
    maxDepth,
    timeoutMs
  };
  const cachedResolved = cache.getResolvedData(coId, cacheOptions);
  
  if (cachedResolved) {
    // Return cached result immediately - no need to re-resolve
    // But we still need to check schema filter if provided
    if (schemas !== null && schemas.length > 0) {
      const dataSchema = cachedResolved.$schema;
      if (!schemas.includes(dataSchema)) {
        return { id: coId }; // Schema not in filter
      }
    }
    return cachedResolved;
  }
  
  try {
    // Use backend.read() directly (same universal API used everywhere)
    // CRITICAL: Do NOT use resolveReferences here to avoid infinite loop
    // (resolveCoId -> backend.read(resolveReferences) -> resolveCoValueReferences -> resolveCoId)
    const { waitForStoreReady } = await import('./read-operations.js');
    
    // Read the co-value using backend.read() API (reuses its caching)
    // Use deepResolve: false to get raw data, then we'll resolve nested co-ids ourselves
    const coValueStore = await backend.read(null, coId, null, null, {
      deepResolve: false, // Don't deep resolve here - we'll resolve nested refs ourselves
      timeoutMs
    });
    
    if (!coValueStore) {
      console.warn(`[resolveCoId] No store returned for ${coId.substring(0, 12)}...`);
      return { id: coId };
    }
    
    // Wait for store to be ready
    try {
      await waitForStoreReady(coValueStore, coId, timeoutMs);
    } catch (err) {
      console.warn(`[resolveCoId] Store not ready for ${coId.substring(0, 12)}...:`, err.message);
      return { id: coId };
    }
    
    const coValueData = coValueStore.value;
    
    // Validate data before processing
    if (!coValueData) {
      console.warn(`[resolveCoId] No data in store for ${coId.substring(0, 12)}...`);
      return { id: coId };
    }
    
    // Handle error objects
    if (coValueData.error) {
      console.warn(`[resolveCoId] Store has error for ${coId.substring(0, 12)}...:`, coValueData.error);
      return { id: coId, error: coValueData.error };
    }
    
    // Ensure data is an object
    if (typeof coValueData !== 'object' || Array.isArray(coValueData)) {
      console.warn(`[resolveCoId] Invalid data type for ${coId.substring(0, 12)}...:`, typeof coValueData);
      return { id: coId };
    }
    
    // Check if we should resolve based on schema filter
    if (schemas !== null && schemas.length > 0) {
      const dataSchema = coValueData.$schema;
      if (!schemas.includes(dataSchema)) {
        return { id: coId }; // Schema not in filter - return object with id
      }
    }
    
    // Mark as visited to prevent circular references
    visited.add(coId);
    
    // Resolve nested co-id references recursively
    const resolved = await resolveCoValueReferences(
      backend, 
      coValueData, 
      options, 
      visited, 
      maxDepth, 
      currentDepth + 1
    );
    
    // Ensure id is always present
    const finalResolved = {
      ...resolved,
      id: resolved.id || coValueData.id || coId
    };
    
    // Cache the resolved result for future use (prevents expensive re-resolution)
    cache.setResolvedData(coId, cacheOptions, finalResolved);
    
    return finalResolved;
  } catch (err) {
    console.error(`[resolveCoId] ❌ Error resolving ${coId.substring(0, 12)}...:`, err);
    return { id: coId };
  }
}

/**
 * Extract CoStream with session structure preserved and CRDT metadata
 * Backend-to-backend helper for inbox processing
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {Object|null} CoStream data with sessions and CRDT metadata, or null if not a CoStream
 */
export function extractCoStreamWithSessions(backend, coValueCore) {
  const content = backend.getCurrentContent(coValueCore);
  const header = backend.getHeader(coValueCore);
  const headerMeta = header?.meta || null;
  const rawType = content?.type || 'unknown';
  
  // Only handle CoStreams
  if (rawType !== 'costream' || !content) {
    return null;
  }
  
  // CoStream content is RawCoStreamView which has items property: { [sessionID]: CoStreamItem[] }
  // Each CoStreamItem has { value, tx, madeAt }
  // If schema specifies items as co-id references ($co), value will be a co-id string
  // Otherwise, value will be the message data (plain object)
  if (content.items && typeof content.items === 'object') {
    const sessions = {};
    
    // Iterate over each session
    for (const [sessionID, items] of Object.entries(content.items)) {
      if (Array.isArray(items)) {
        // Map items to include message data + CRDT metadata
        // Preserve original item structure to check if value is a co-id reference
        sessions[sessionID] = items.map(item => {
          // Check if item.value is a co-id reference (starts with co_z)
          const isCoIdReference = typeof item.value === 'string' && item.value.startsWith('co_z');
          
          if (isCoIdReference) {
            // Item is a co-id reference to a CoMap - return co-id for later reading
            return {
              _coId: item.value, // Message CoMap co-id (native co-id)
              _sessionID: sessionID, // Internal metadata: session ID
              _madeAt: item.madeAt, // Internal metadata: CRDT madeAt timestamp
              _tx: item.tx // Internal metadata: transaction ID
            };
          } else {
            // Item is plain object (legacy format) - spread message data
            return {
              ...item.value, // Message data (type, payload, from, id)
              _sessionID: sessionID, // Internal metadata: session ID
              _madeAt: item.madeAt, // Internal metadata: CRDT madeAt timestamp
              _tx: item.tx // Internal metadata: transaction ID
            };
          }
        });
      }
    }
    
    return {
      id: coValueCore.id,
      type: 'costream',
      $schema: headerMeta?.$schema || null,
      sessions: sessions // Preserve session structure: { sessionID: [messages...] }
    };
  }
  
  // Fallback: empty stream
  return {
    id: coValueCore.id,
    type: 'costream',
    $schema: headerMeta?.$schema || null,
    sessions: {}
  };
}
