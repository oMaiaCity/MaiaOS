/**
 * Config Loader Utility
 * 
 * Shared utility for loading and validating configs from database.
 * Handles the common pattern: load schema, query database, validate against schema.
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
import { validateCoId } from './co-id-validator.js';

/**
 * Load and validate a config from database by co-id
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaRef - Schema reference (e.g., '@schema/actor', '@schema/view')
 * @param {string} coId - Config co-id (must start with 'co_z')
 * @param {string} configType - Config type for error messages (e.g., 'actor', 'view')
 * @param {Map} cache - Optional cache map (coId -> config) to avoid duplicate loads
 * @returns {Promise<Object>} The loaded and validated config
 * @throws {Error} If co-id is invalid, config not found, or validation fails
 */
export async function loadConfig(dbEngine, schemaRef, coId, configType, cache = null) {
  // Validate co-id format
  validateCoId(coId, configType);
  
  // Check cache first
  if (cache && cache.has(coId)) {
    return cache.get(coId);
  }
  
  // Ensure database engine is available
  if (!dbEngine) {
    throw new Error(`[${configType}] Database engine not available`);
  }
  
  // Query database
  const config = await dbEngine.execute({
    op: 'query',
    schema: schemaRef,
    key: coId
  });
  
  if (!config) {
    throw new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
  }
  
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
}

/**
 * Load a config that might be a co-id or already an object
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaRef - Schema reference
 * @param {string|Object} coIdOrConfig - Either a co-id string or pre-loaded config object
 * @param {string} configType - Config type for error messages
 * @param {Map} cache - Optional cache map
 * @returns {Promise<Object>} The loaded and validated config
 */
export async function loadConfigOrUseProvided(dbEngine, schemaRef, coIdOrConfig, configType, cache = null) {
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
