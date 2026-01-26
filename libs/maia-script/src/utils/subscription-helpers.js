/**
 * Subscription Helpers
 * 
 * Shared utilities for setting up config subscriptions across engines.
 * Consolidates common patterns for schema co-id resolution and subscription setup.
 */

/**
 * Get schema co-id safely with consistent error handling
 * PREFERRED: Use fromCoValue pattern to extract schema from CoValue's headerMeta.$schema
 * @param {Object} dbEngine - Database engine instance
 * @param {string|Object} configTypeOrOptions - Config type (e.g., 'view', 'style') OR options object
 * @param {string} [options.fromCoValue] - CoValue co-id - extracts headerMeta.$schema (PREFERRED)
 * @returns {Promise<string>} Schema co-id
 * @throws {Error} If schema co-id cannot be resolved
 */
export async function getSchemaCoIdSafe(dbEngine, configTypeOrOptions, options = {}) {
  if (!dbEngine) {
    throw new Error(`[getSchemaCoIdSafe] Database engine not available`);
  }
  
  // Handle options object as first parameter
  let configType = configTypeOrOptions;
  let fromCoValue = options?.fromCoValue;
  
  if (configTypeOrOptions && typeof configTypeOrOptions === 'object' && !Array.isArray(configTypeOrOptions)) {
    configType = configTypeOrOptions.configType;
    fromCoValue = configTypeOrOptions.fromCoValue;
  }
  
  // PREFERRED: Extract schema from CoValue's headerMeta.$schema
  if (fromCoValue) {
    if (!fromCoValue.startsWith('co_z')) {
      throw new Error(`[getSchemaCoIdSafe] fromCoValue must be a valid co-id (co_z...), got: ${fromCoValue}`);
    }
    const schemaStore = await dbEngine.execute({
      op: 'schema',
      fromCoValue: fromCoValue
    });
    const schemaCoId = schemaStore.value?.$id;
    if (!schemaCoId) {
      throw new Error(`[getSchemaCoIdSafe] Failed to extract schema co-id from CoValue ${fromCoValue}. CoValue must have $schema in headerMeta.`);
    }
    return schemaCoId;
  }
  
  // Fallback: Schema name resolution (for cases where we don't have instance co-id)
  // This should be rare - prefer fromCoValue pattern
  if (configType) {
    // Use resolve operation (seeding-only pattern, but kept for backward compatibility)
    const schemaKey = `@schema/${configType}`;
    const schemaCoId = await dbEngine.execute({ op: 'resolve', humanReadableKey: schemaKey });
    if (!schemaCoId) {
      throw new Error(`[getSchemaCoIdSafe] Failed to resolve ${configType} schema co-id. Use fromCoValue pattern instead if you have an instance co-id.`);
    }
    return schemaCoId;
  }
  
  throw new Error(`[getSchemaCoIdSafe] Either configType or fromCoValue must be provided`);
}

/**
 * Create a config subscription with common pattern
 * Handles schema co-id resolution, subscription setup, and unsubscribe storage
 * @param {Object} options - Subscription options
 * @param {Object} options.dbEngine - Database engine instance
 * @param {string} options.configType - Config type (e.g., 'view', 'style', 'state')
 * @param {string} options.coId - Config co-id
 * @param {Function} [options.onUpdate] - Optional callback when config changes
 * @param {Map} [options.cache] - Optional cache map
 * @param {Map} [options.subscriptionsMap] - Optional subscriptions map to store unsubscribe function
 * @param {Function} [options.onUpdateWrapper] - Optional wrapper for onUpdate callback
 * @returns {Promise<{config: Object, unsubscribe: Function}>} Config and unsubscribe function
 */
export async function createConfigSubscription({
  dbEngine,
  configType,
  coId,
  onUpdate = null,
  cache = null,
  subscriptionsMap = null,
  onUpdateWrapper = null
}) {
  // Extract schema co-id from config instance's headerMeta.$schema using fromCoValue pattern
  const schemaCoId = await getSchemaCoIdSafe(dbEngine, { fromCoValue: coId });
  
  // Wrap onUpdate if wrapper provided
  const wrappedOnUpdate = onUpdateWrapper 
    ? (updatedConfig) => {
        onUpdateWrapper(updatedConfig, coId);
        if (onUpdate) {
          onUpdate(updatedConfig);
        }
      }
    : onUpdate;
  
  const { subscribeConfig } = await import('./config-loader.js');
  const { config, unsubscribe } = await subscribeConfig(
    dbEngine,
    schemaCoId,
    coId,
    configType,
    wrappedOnUpdate,
    cache
  );
  
  // Store unsubscribe function if subscriptions map provided
  if (subscriptionsMap) {
    subscriptionsMap.set(coId, unsubscribe);
  }
  
  return { config, unsubscribe };
}
