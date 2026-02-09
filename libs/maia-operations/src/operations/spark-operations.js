/**
 * Spark Operations - CRUD operations for Sparks (group references)
 * 
 * Sparks are CoMaps that reference groups, allowing users to organize
 * their data into separate collaborative spaces.
 */

import { ReactiveStore } from '../reactive-store.js';
import { resolve } from '@MaiaOS/db';
import { 
  requireParam, 
  validateCoId, 
  requireDbEngine
} from '@MaiaOS/schemata/validation.helper';

/**
 * Create a new Spark
 * Creates a child group owned by universal group, then creates Spark CoMap
 * @param {Object} backend - Backend instance
 * @param {Object} dbEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.name - Spark name
 * @returns {Promise<Object>} Created spark with co-id
 */
export async function createSparkOperation(backend, dbEngine, params) {
  const { name } = params;
  requireParam(name, 'name', 'CreateSparkOperation');
  requireDbEngine(dbEngine, 'CreateSparkOperation', 'spark creation');
  
  return await backend.createSpark(name);
}

/**
 * Read Spark(s)
 * @param {Object} backend - Backend instance
 * @param {Object} params - Operation parameters
 * @param {string} [params.id] - Specific spark co-id
 * @param {string} [params.schema] - Schema co-id (optional, defaults to spark schema)
 * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) with spark data
 */
export async function readSparkOperation(backend, params) {
  const { id, schema } = params;
  
  if (id) {
    validateCoId(id, 'ReadSparkOperation');
    return await backend.readSpark(id);
  }
  
  // Collection read - use spark schema or provided schema
  const sparkSchema = schema || '@schema/data/spark';
  return await backend.readSpark(null, sparkSchema);
}

/**
 * Update Spark
 * @param {Object} backend - Backend instance
 * @param {Object} dbEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @param {Object} params.data - Update data (name, group)
 * @returns {Promise<Object>} Updated spark
 */
export async function updateSparkOperation(backend, dbEngine, params) {
  const { id, data } = params;
  requireParam(id, 'id', 'UpdateSparkOperation');
  validateCoId(id, 'UpdateSparkOperation');
  requireParam(data, 'data', 'UpdateSparkOperation');
  requireDbEngine(dbEngine, 'UpdateSparkOperation', 'spark update');
  
  return await backend.updateSpark(id, data);
}

/**
 * Delete Spark
 * @param {Object} backend - Backend instance
 * @param {Object} dbEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteSparkOperation(backend, dbEngine, params) {
  const { id } = params;
  requireParam(id, 'id', 'DeleteSparkOperation');
  validateCoId(id, 'DeleteSparkOperation');
  requireDbEngine(dbEngine, 'DeleteSparkOperation', 'spark deletion');
  
  return await backend.deleteSpark(id);
}
