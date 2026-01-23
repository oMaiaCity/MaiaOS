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
 * Subscribe to a config and get initial value + updates
 * Returns a Promise that resolves with {config, unsubscribe} when initial value is received
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaRef - Schema co-id (must start with 'co_z', NOT '@schema/...')
 * @param {string} coId - Config co-id (must start with 'co_z')
 * @param {string} configType - Config type for error messages (e.g., 'actor', 'view')
 * @param {Function} onUpdate - Callback called when config changes: (newConfig) => void
 * @param {Map} cache - Optional cache map (coId -> config) to avoid duplicate loads
 * @returns {Promise<{config: Object, unsubscribe: Function}>} Initial config and unsubscribe function
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
  
  // Helper to validate and cache config
  const validateAndCache = async (config) => {
    if (!config) return null;
    
    // Load schema and validate
    const schema = await loadSchemaFromDB(dbEngine, configType);
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, config, configType);
    }
    
    // Cache if cache provided
    if (cache) {
      cache.set(coId, config);
    }
    
    return config;
  };
  
  // Check cache first - if cached, still set up subscription for updates
  if (cache && cache.has(coId)) {
    const cachedConfig = cache.get(coId);
    
    // Set up subscription for future updates
    // Query operation returns unsubscribe function (may be Promise or direct)
    const unsubscribe = await dbEngine.execute({
      op: 'query',
      schema: schemaRef,
      key: coId,
      callback: async (newConfig) => {
        const validated = await validateAndCache(newConfig);
        if (validated) {
          onUpdate(validated);
        }
      }
    });
    
    return { config: cachedConfig, unsubscribe };
  }
  
  // Subscribe to config changes
  // The query operation will call callback immediately with current data, then on updates
  let initialConfig = null;
  let initialConfigResolved = false;
  let initialConfigError = null;
  let unsubscribeFn = null;
  
  // Set up subscription - query operation handles initial callback + subscription
  unsubscribeFn = await dbEngine.execute({
    op: 'query',
    schema: schemaRef,
    key: coId,
    callback: async (config) => {
      try {
        const validated = await validateAndCache(config);
        
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
    }
  });
  
  // Wait for initial callback to fire (query operation calls it immediately)
  // Use a small delay to ensure async callback has fired
  let attempts = 0;
  while (!initialConfigResolved && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 10));
    attempts++;
  }
  
  // Check for errors first
  if (initialConfigError) {
    throw initialConfigError;
  }
  
  if (!initialConfig) {
    throw new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
  }
  
  return { config: initialConfig, unsubscribe: unsubscribeFn };
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
 * @returns {Promise<Array<{config: Object, unsubscribe: Function}>>} Array of results matching request order
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
  
  // Batch get all configs in a single transaction (all configs are in the same 'configs' store)
  // Collect all co-ids regardless of schema
  const allCoIds = requests.map(req => req.coId);
  // Use first request's schemaRef for getBatch (not used by getBatch, but required for validation)
  // All configs are in the same 'configs' store, so schema doesn't matter for batching
  const configsMap = allCoIds.length > 0 
    ? await dbEngine.backend.getBatch(requests[0].schemaRef, allCoIds)
    : new Map();
  
  // Helper to validate and cache config
  const validateAndCache = async (config, configType, coId, cache) => {
    if (!config) return null;
    
    // Load schema and validate
    const schema = await loadSchemaFromDB(dbEngine, configType);
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, config, configType);
    }
    
    // Cache if cache provided
    if (cache) {
      cache.set(coId, config);
    }
    
    return config;
  };
  
  // Process each request: validate cached configs, set up subscriptions
  const results = await Promise.all(
    requests.map(async (req, index) => {
      const { schemaRef, coId, configType, onUpdate, cache } = req;
      
      // Check cache first
      if (cache && cache.has(coId)) {
        const cachedConfig = cache.get(coId);
        
        // Set up subscription for future updates
        const unsubscribe = await dbEngine.execute({
          op: 'query',
          schema: schemaRef,
          key: coId,
          callback: async (newConfig) => {
            const validated = await validateAndCache(newConfig, configType, coId, cache);
            if (validated) {
              onUpdate(validated);
            }
          }
        });
        
        return { config: cachedConfig, unsubscribe, index };
      }
      
      // Get config from batch results
      let config = configsMap.get(coId);
      
      // Validate and cache config if found
      if (config) {
        config = await validateAndCache(config, configType, coId, cache);
      }
      
      // If config not found in batch results, it will be loaded by subscription callback
      // Set up subscription - query operation handles initial callback + subscription
      let initialConfig = config;
      let initialConfigResolved = !!config;
      let initialConfigError = null;
      let unsubscribeFn = null;
      
      unsubscribeFn = await dbEngine.execute({
        op: 'query',
        schema: schemaRef,
        key: coId,
        callback: async (newConfig) => {
          try {
            const validated = await validateAndCache(newConfig, configType, coId, cache);
            
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
      
      return { config: initialConfig, unsubscribe: unsubscribeFn, index };
    })
  );
  
  // Return results in original request order
  return results.sort((a, b) => a.index - b.index).map(({ config, unsubscribe }) => ({ config, unsubscribe }));
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
    // Load schema and validate
    const schema = await loadSchemaFromDB(dbEngine, configType);
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, coIdOrConfig, configType);
    }
    return coIdOrConfig;
  }
  
  // Otherwise, load from database
  return await loadConfig(dbEngine, schemaRef, coIdOrConfig, configType, cache);
}
