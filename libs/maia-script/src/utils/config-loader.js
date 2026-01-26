/**
 * Config Loader Utility
 * 
 * Shared utility for loading and validating configs from database.
 * Handles the common pattern: load schema, query database, validate against schema.
 * 
 * IMPORTANT: All config loading now uses subscriptions for end-to-end reactivity.
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
import { validateCoId } from './co-id-validator.js';

/**
 * Strip system metadata properties before validation
 * These are added by backend/convertPropertiesArrayToPlainObject but not allowed by schemas with additionalProperties: false
 * Also cleans up query objects to ensure they only have schema and filter properties (no extra metadata)
 * @param {Object} config - Config object to clean
 * @returns {Object} Cleaned config without system metadata
 */
function stripMetadataForValidation(config) {
    if (!config || typeof config !== 'object') {
      return config;
    }
    // Strip all system metadata properties added by backend
    const {
      id,              // CoValue co-id
      $schema,         // Schema reference from headerMeta
      type,            // CoValue type (comap, colist, etc.)
      headerMeta,      // Header metadata
      properties,       // Properties array (backend format)
      propertiesCount, // Count of properties
      hasProperties,   // Boolean flag
      loading,         // Loading state
      error,           // Error state
      displayName,     // Display name for DB viewer
      ...cleanConfig   // Keep only actual config properties
    } = config;
    
    // Recursively clean query objects to ensure they only have schema and filter properties
    // Query objects must match schema exactly: {schema: "co_z...", filter: {...}|null}
    // No additional properties allowed (strict validation)
    const cleanQueryObjects = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
      }
      
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        // Check if this is a query object (has schema property that's a string)
        if (value && typeof value === 'object' && !Array.isArray(value) && value.schema && typeof value.schema === 'string') {
          // Clean query object: only keep schema and filter properties
          const cleanedQueryObj = {
            schema: value.schema
          };
          if ('filter' in value) {
            cleanedQueryObj.filter = value.filter;
          }
          cleaned[key] = cleanedQueryObj;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recursively clean nested objects
          cleaned[key] = cleanQueryObjects(value);
        } else if (value && Array.isArray(value)) {
          // Arrays are passed through as-is (they're already plain JS arrays)
          cleaned[key] = value;
        } else {
          // Primitives are passed through as-is
          cleaned[key] = value;
        }
      }
      return cleaned;
    };
    
  return cleanQueryObjects(cleanConfig);
}

/**
 * Subscribe to a config and get initial value + updates
 * Returns a Promise that resolves with {config, unsubscribe} when initial value is received
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaRef - Schema co-id (must start with 'co_z', NOT '@schema/...')
 * @param {string} coId - Config co-id (must start with 'co_z')
 * @param {string} configType - Config type for error messages (e.g., 'actor', 'view')
 * @param {Function} onUpdate - Callback called when config changes: (newConfig) => void
 * @param {Map} cache - Optional cache map (coId -> config) to avoid duplicate loads
 * @returns {Promise<{config: Object, unsubscribe: Function, store: ReactiveStore}>} Initial config, unsubscribe function, and reactive store
 * @throws {Error} If co-id is invalid, config not found, or validation fails
 */
export async function subscribeConfig(dbEngine, schemaRef, coId, configType, onUpdate, cache = null) {
  // Validate schemaRef is a co-id (not human-readable)
  if (!schemaRef || !schemaRef.startsWith('co_z')) {
    throw new Error(`[${configType}] schemaRef must be a co-id (co_z...), got: ${schemaRef}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
  }
  
  // Validate co-id format
  validateCoId(coId, configType);
  
  // Ensure database engine is available
  if (!dbEngine) {
    throw new Error(`[${configType}] Database engine not available`);
  }
  
  // Helper to convert and validate config
  const convertAndValidate = async (config) => {
    if (!config) return null;
    
    // Convert from properties array format if needed
    const plainConfig = convertPropertiesArrayToPlainObject(config);
    
    // CRITICAL: Load schema from CoValue's header metadata (single source of truth)
    // Use fromCoValue to extract schema from headerMeta.$schema
    const schema = await loadSchemaFromDB(dbEngine, { fromCoValue: coId });
    if (schema) {
      // Strip system metadata before validation (id, $schema, schema, type, headerMeta, etc.)
      // These are added by backend but not allowed by schemas with additionalProperties: false
      const configForValidation = stripMetadataForValidation(plainConfig);
      await validateAgainstSchemaOrThrow(schema, configForValidation, `${configType} (${coId})`);
    }
    
    // Cache if cache provided (keep metadata in cache for other uses)
    if (cache) {
      cache.set(coId, plainConfig);
    }
    
    return plainConfig;
  };
  
  // Check cache first - if cached, still set up subscription for updates
  if (cache && cache.has(coId)) {
    const cachedConfig = cache.get(coId);
    
    // Set up subscription for future updates using read() operation
    const store = await dbEngine.execute({
      op: 'read',
      schema: schemaRef,
      key: coId
    });
    
    const unsubscribe = store.subscribe(async (newConfig) => {
      try {
        const validated = await convertAndValidate(newConfig);
        if (validated) {
          onUpdate(validated);
        }
      } catch (error) {
        console.error(`[${configType}] Error validating config in subscription callback:`, error);
        // Don't throw - subscription callbacks shouldn't throw unhandled errors
      }
    });
    
    return { config: cachedConfig, unsubscribe, store };
  }
  
  // Subscribe to config changes using read() operation
  // Read operation returns reactive store that calls callback immediately, then on updates
  let initialConfig = null;
  let initialConfigResolved = false;
  let initialConfigError = null;
  
  // Set up subscription - read operation returns reactive store
  const store = await dbEngine.execute({
    op: 'read',
    schema: schemaRef,
    key: coId
  });
  
  // Subscribe to store updates
  // Backend's _readSingleItem ensures store is already loaded, so we can process immediately
  const unsubscribeFn = store.subscribe(async (config) => {
    try {
      // Skip if config has error (backend already loaded it, so if it has error, it's a real error)
      if (config?.error) {
        if (!initialConfigResolved) {
          initialConfigResolved = true;
          initialConfigError = new Error(`Failed to load ${configType} from database by co-id: ${coId}: ${config.error}`);
        }
        return;
      }
      
      // Backend ensures config is loaded, so process it
      const validated = await convertAndValidate(config);
      
      // First callback is the initial value
      if (!initialConfigResolved) {
        if (!validated) {
          initialConfigResolved = true;
          initialConfigError = new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
          return;
        }
        
        initialConfig = validated;
        initialConfigResolved = true;
        // Call onUpdate with initial value (for consistency)
        onUpdate(validated);
      } else {
        // Subsequent updates
        if (validated) {
          onUpdate(validated);
        }
      }
    } catch (error) {
      if (!initialConfigResolved) {
        initialConfigResolved = true;
        initialConfigError = error;
      }
    }
  });
  
  // Backend ensures store is loaded, so process initial value immediately
  const initialValue = store.value;
  if (initialValue && !initialValue.error) {
    try {
      const validated = await convertAndValidate(initialValue);
      if (validated) {
        initialConfig = validated;
        initialConfigResolved = true;
        onUpdate(validated);
      }
    } catch (error) {
      initialConfigResolved = true;
      initialConfigError = error;
    }
  }
  
  // Wait briefly for async validation to complete (if not already resolved)
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds total (50 * 100ms) - should be instant since backend loaded it
  while (!initialConfigResolved && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  // Check for errors first
  if (initialConfigError) {
    throw initialConfigError;
  }
  
  if (!initialConfig) {
    throw new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
  }
  
  return { config: initialConfig, unsubscribe: unsubscribeFn, store };
}

/**
 * Load and validate a config from database by co-id (one-time, for backwards compatibility)
 * @deprecated Use subscribeConfig() for reactive configs. This function will be removed.
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaRef - Schema co-id (must start with 'co_z', NOT '@schema/...')
 * @param {string} coId - Config co-id (must start with 'co_z')
 * @param {string} configType - Config type for error messages (e.g., 'actor', 'view')
 * @param {Map} cache - Optional cache map (coId -> config) to avoid duplicate loads
 * @returns {Promise<Object>} The loaded and validated config
 * @throws {Error} If co-id is invalid, config not found, or validation fails
 */
export async function loadConfig(dbEngine, schemaRef, coId, configType, cache = null) {
  // Use subscription but only wait for initial value
  const { config } = await subscribeConfig(dbEngine, schemaRef, coId, configType, () => {
    // Ignore updates for one-time loads
  }, cache);
  return config;
}

/**
 * Subscribe to multiple configs in a single batch operation
 * Optimizes performance by batching DB queries and subscription setup
 * @param {Object} dbEngine - Database engine instance
 * @param {Array} requests - Array of subscription requests: [{schemaRef, coId, configType, onUpdate, cache}, ...]
 * @returns {Promise<Array<{config: Object, unsubscribe: Function, store: ReactiveStore}>>} Array of results matching request order
 */
export async function subscribeConfigsBatch(dbEngine, requests) {
  if (!requests || requests.length === 0) {
    return [];
  }
  
  // Validate all requests
  for (const req of requests) {
    if (!req.schemaRef || !req.schemaRef.startsWith('co_z')) {
      throw new Error(`[${req.configType}] schemaRef must be a co-id (co_z...), got: ${req.schemaRef}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    validateCoId(req.coId, req.configType);
  }
  
  if (!dbEngine) {
    throw new Error(`[subscribeConfigsBatch] Database engine not available`);
  }
  
  // Batch read all configs using unified read() operation with keys parameter
  // Collect all co-ids regardless of schema
  const allCoIds = requests.map(req => req.coId);
  // Use first request's schemaRef for read() (not used for batch reads, but required for validation)
  // All configs are in the same 'configs' store, so schema doesn't matter for batching
  // read() with keys returns array of ReactiveStores - map them back to co-ids
  const batchStores = allCoIds.length > 0 
    ? await dbEngine.execute({
        op: 'read',
        schema: requests[0].schemaRef,
        keys: allCoIds
      })
    : [];
  
  // Create a Map from co-ids to stores for easy lookup
  const configsMap = new Map();
  allCoIds.forEach((coId, index) => {
    if (batchStores[index]) {
      configsMap.set(coId, batchStores[index].value);
    }
  });
  
  // Helper to convert and validate config
  const convertAndValidate = async (config, configType, coId, cache) => {
    if (!config) return null;
    
    // Convert from properties array format if needed
    const plainConfig = convertPropertiesArrayToPlainObject(config);
    
    // CRITICAL: Load schema from CoValue's header metadata (single source of truth)
    // Use fromCoValue to extract schema from headerMeta.$schema
    const schema = await loadSchemaFromDB(dbEngine, { fromCoValue: coId });
    if (schema) {
      // Strip system metadata before validation (id, $schema, schema, type, headerMeta, etc.)
      // These are added by backend but not allowed by schemas with additionalProperties: false
      const configForValidation = stripMetadataForValidation(plainConfig);
      await validateAgainstSchemaOrThrow(schema, configForValidation, `${configType} (${coId})`);
    }
    
    // Cache if cache provided
    if (cache) {
      cache.set(coId, plainConfig);
    }
    
    return plainConfig;
  };
  
  // Process each request: validate cached configs, set up subscriptions
  const results = await Promise.all(
    requests.map(async (req, index) => {
      const { schemaRef, coId, configType, onUpdate, cache } = req;
      
      // Check cache first
      if (cache && cache.has(coId)) {
        const cachedConfig = cache.get(coId);
        
        // Set up subscription for future updates using read() operation
        const store = await dbEngine.execute({
          op: 'read',
          schema: schemaRef,
          key: coId
        });
        
        const unsubscribe = store.subscribe(async (newConfig) => {
          try {
            const validated = await convertAndValidate(newConfig, configType, coId, cache);
            if (validated) {
              onUpdate(validated);
            }
          } catch (error) {
            console.error(`[${configType}] Error validating config in subscription callback:`, error);
            // Don't throw - subscription callbacks shouldn't throw unhandled errors
          }
        });
        
        return { config: cachedConfig, unsubscribe, index, store };
      }
      
      // Get config from batch results
      let config = configsMap.get(coId);
      
      // Validate and cache config if found
      if (config) {
        config = await convertAndValidate(config, configType, coId, cache);
      }
      
      // If config not found in batch results, it will be loaded by subscription callback
      // Set up subscription - read operation returns reactive store
      let initialConfig = config;
      let initialConfigResolved = !!config;
      let initialConfigError = null;
      
      const store = await dbEngine.execute({
        op: 'read',
        schema: schemaRef,
        key: coId
      });
      
      const unsubscribeFn = store.subscribe(async (newConfig) => {
        try {
          const validated = await convertAndValidate(newConfig, configType, coId, cache);
          
          // First callback is the initial value
          if (!initialConfigResolved) {
            if (!validated) {
              initialConfigResolved = true;
              initialConfigError = new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
              return;
            }
            
            initialConfig = validated;
            initialConfigResolved = true;
            // Call onUpdate with initial value (for consistency)
            onUpdate(validated);
          } else {
            // Subsequent updates
            if (validated) {
              onUpdate(validated);
            }
          }
        } catch (error) {
          if (!initialConfigResolved) {
            initialConfigResolved = true;
            initialConfigError = error;
          }
        }
      });
      
      // If config was already loaded from batch, we're done
      // Otherwise, wait for initial callback from subscription
      if (!initialConfigResolved) {
        let attempts = 0;
        while (!initialConfigResolved && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 10));
          attempts++;
        }
        
        if (initialConfigError) {
          throw initialConfigError;
        }
        
        if (!initialConfig) {
          throw new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
        }
      }
      
      return { config: initialConfig, unsubscribe: unsubscribeFn, index, store };
    })
  );
  
  // Return results in original request order
  return results.sort((a, b) => a.index - b.index).map(({ config, unsubscribe, store }) => ({ config, unsubscribe, store }));
}

/**
 * Convert CoJSON backend format (properties array) to plain object
 * CoJSON backend returns objects with properties array for DB viewer - convert to plain object for config usage
 * Also adds $schema from headerMeta (system property) for engine compatibility
 * Recursively handles nested objects to ensure they remain objects (not arrays)
 * @param {Object} config - Config object (may have properties array or already be plain object)
 * @param {boolean} requireSchema - Whether to require $schema (true for top-level CoValues, false for nested objects)
 * @returns {Object} Plain object with properties as keys and $schema from headerMeta
 */
function convertPropertiesArrayToPlainObject(config, requireSchema = true) {
  if (!config || typeof config !== 'object') {
    return config;
  }
  
  // Handle CoLists/CoStreams specially - they have items array, not properties array
  // They come from _extractCoValueData with $schema already set
  if (config.type === 'colist' || config.type === 'costream') {
    // CoLists/CoStreams: items are the content, not properties
    // They should already have $schema from _extractCoValueData, but handle schema -> $schema conversion
    const result = {
      id: config.id,
      type: config.type,
      items: config.items || []
    };
    
    // Ensure $schema is set (prefer $schema, fallback to schema if needed)
    if (config.$schema) {
      result.$schema = config.$schema;
    } else if (config.schema) {
      // Convert schema to $schema (shouldn't happen but handle it)
      result.$schema = config.schema;
    } else {
      // No fallback - $schema must exist (100% migration)
      throw new Error(`[convertPropertiesArrayToPlainObject] CoList/CoStream config must have $schema in headerMeta. Config keys: ${JSON.stringify(Object.keys(config))}`);
    }
    
    return result;
  }
  
  // If it has a properties array (CoJSON backend format), convert to plain object
  if (Array.isArray(config.properties)) {
    const plainConfig = {};
    // Copy metadata fields
    if (config.id) plainConfig.id = config.id;
    if (config.$schema) {
      // Preserve $schema from headerMeta (primary field)
      plainConfig.$schema = config.$schema; // System property from headerMeta.$schema
    } else {
      // No fallback - $schema must exist in headerMeta (100% migration)
      throw new Error(`[convertPropertiesArrayToPlainObject] Config must have $schema in headerMeta. Got: ${JSON.stringify(Object.keys(config))}`);
    }
    if (config.type) plainConfig.type = config.type;
    if (config.headerMeta) plainConfig.headerMeta = config.headerMeta;
    
    // Convert properties array to plain object
    for (const prop of config.properties) {
      if (prop && prop.key !== undefined) {
        let value = prop.value;
        
        // Handle nested objects/CoMaps that might need conversion
        // If value is a CoMap-like object (has .get and .keys methods), convert it
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (value.get && typeof value.get === 'function' && value.keys && typeof value.keys === 'function') {
            // It's a CoMap - convert to plain object recursively
            // Nested CoMaps don't require $schema (they're properties, not top-level configs)
            const nestedObj = {};
            try {
              const keys = value.keys();
              for (const key of keys) {
                const nestedValue = value.get(key);
                nestedObj[key] = convertPropertiesArrayToPlainObject({ properties: [{ key, value: nestedValue }] }, false);
              }
            } catch (e) {
              console.warn(`[convertPropertiesArrayToPlainObject] Error converting CoMap for key ${prop.key}:`, e);
            }
            value = nestedObj;
          } else if (Array.isArray(value.properties)) {
            // It's already in properties array format - convert recursively
            // Check if it's a nested CoValue (has id/type) or just a nested object
            const isNestedCoValue = value.id || value.type || value.$schema;
            value = convertPropertiesArrayToPlainObject(value, isNestedCoValue);
          } else {
            // Plain object - recursively convert nested properties that might be in properties array format
            // Nested plain objects don't require $schema
            value = convertPropertiesArrayToPlainObject(value, false);
          }
        }
        
        // CRITICAL: If value was stringified (for display), try to parse it back
        // But only if it looks like JSON (starts with { or [)
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
            // Recursively convert if it's an object
            // Parsed nested objects don't require $schema
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              value = convertPropertiesArrayToPlainObject(value, false);
            }
          } catch (e) {
            // Not valid JSON, keep as string
          }
        }
        
        // Ensure arrays stay as arrays, objects stay as objects
        plainConfig[prop.key] = value;
      }
    }
    return plainConfig;
  }
  
  // Already a plain object - recursively convert nested objects that might be in properties array format
  const result = {};
  for (const [key, value] of Object.entries(config)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively convert nested objects
      if (Array.isArray(value.properties)) {
        // Check if it's a nested CoValue (has id/type) or just a nested object
        const isNestedCoValue = value.id || value.type || value.$schema;
        result[key] = convertPropertiesArrayToPlainObject(value, isNestedCoValue);
      } else if (value.get && typeof value.get === 'function' && value.keys && typeof value.keys === 'function') {
        // It's a CoMap - convert to plain object recursively
        // Nested CoMaps don't require $schema (they're properties, not top-level configs)
        const nestedObj = {};
        const keys = value.keys();
        for (const nestedKey of keys) {
          nestedObj[nestedKey] = convertPropertiesArrayToPlainObject({ properties: [{ key: nestedKey, value: value.get(nestedKey) }] }, false);
        }
        result[key] = nestedObj;
      } else {
        // Plain object - recursively convert nested properties
        // CRITICAL: Pass a flag to indicate this is a nested object (not a top-level CoValue)
        // Nested objects don't need $schema - only top-level CoValue configs do
        result[key] = convertPropertiesArrayToPlainObject(value, false);
      }
    } else {
      result[key] = value;
    }
  }
  
  // Ensure $schema is set ONLY for top-level CoValue configs (not nested objects)
  // Check if this is a CoValue by looking for CoValue metadata (id, type, or $schema)
  const isCoValue = config.id || config.type || config.$schema || config.headerMeta;
  
  if (isCoValue && requireSchema) {
    // This is a CoValue config - $schema must exist (no fallbacks - 100% migration)
    if (config.$schema && !result.$schema) {
      result.$schema = config.$schema; // Primary: $schema from headerMeta
    } else if (!result.$schema) {
      // No fallback - $schema must exist (100% migration)
      throw new Error(`[convertPropertiesArrayToPlainObject] Config must have $schema in headerMeta. Config keys: ${JSON.stringify(Object.keys(config))}`);
    }
  } else if (config.$schema && !result.$schema) {
    // Preserve $schema if present, even for nested objects (for consistency)
    result.$schema = config.$schema;
  }
  // If not a CoValue (just a nested plain object), don't require $schema
  
  return result;
}

/**
 * Load a config that might be a co-id or already an object
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaRef - Schema co-id (must start with 'co_z', NOT '@schema/...')
 * @param {string|Object} coIdOrConfig - Either a co-id string or pre-loaded config object
 * @param {string} configType - Config type for error messages
 * @param {Map} cache - Optional cache map
 * @returns {Promise<Object>} The loaded and validated config
 */
export async function loadConfigOrUseProvided(dbEngine, schemaRef, coIdOrConfig, configType, cache = null) {
  // Validate schemaRef is a co-id (not human-readable)
  if (!schemaRef || !schemaRef.startsWith('co_z')) {
    throw new Error(`[${configType}] schemaRef must be a co-id (co_z...), got: ${schemaRef}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
  }
  // If it's already an object (pre-loaded config), validate and return it
  if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
    // Convert from properties array format if needed
    const plainConfig = convertPropertiesArrayToPlainObject(coIdOrConfig);
    
    // CRITICAL: Config objects must have $id (co-id) to load schema from headerMeta
    // No fallbacks - all configs must be CoValues with headerMeta.$schema
    if (!plainConfig.$id && !plainConfig.id) {
      throw new Error(`[${configType}] Config object must have $id (co-id) to load schema from headerMeta. Got: ${JSON.stringify(Object.keys(plainConfig))}`);
    }
    
    const configCoId = plainConfig.$id || plainConfig.id;
    if (!configCoId.startsWith('co_z')) {
      throw new Error(`[${configType}] Config $id must be a co-id (co_z...), got: ${configCoId}`);
    }
    
    // Load schema from CoValue's header metadata using fromCoValue pattern
    const schema = await loadSchemaFromDB(dbEngine, { fromCoValue: configCoId });
    if (schema) {
      // Strip system metadata before validation
      const configForValidation = stripMetadataForValidation(plainConfig);
      await validateAgainstSchemaOrThrow(schema, configForValidation, configType);
    }
    return plainConfig;
  }
  
  // Otherwise, load from database
  const config = await loadConfig(dbEngine, schemaRef, coIdOrConfig, configType, cache);
  // Convert from properties array format if needed
  return convertPropertiesArrayToPlainObject(config);
}
