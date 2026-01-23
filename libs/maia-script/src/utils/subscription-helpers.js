/**
 * Subscription Helpers
 * 
 * Shared utilities for setting up config subscriptions across engines.
 * Consolidates common patterns for schema co-id resolution and subscription setup.
 */

/**
 * Get schema co-id safely with consistent error handling
 * @param {Object} dbEngine - Database engine instance
 * @param {string} configType - Config type (e.g., 'view', 'style', 'state', 'actor')
 * @returns {Promise<string>} Schema co-id
 * @throws {Error} If schema co-id cannot be resolved
 */
export async function getSchemaCoIdSafe(dbEngine, configType) {
  if (!dbEngine) {
    throw new Error(`[${configType}] Database engine not available`);
  }
  
  const schemaCoId = await dbEngine.getSchemaCoId(configType);
  if (!schemaCoId) {
    throw new Error(`[${configType}] Failed to resolve ${configType} schema co-id`);
  }
  
  return schemaCoId;
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
  const schemaCoId = await getSchemaCoIdSafe(dbEngine, configType);
  
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
