/**
 * CoJSON Engine - Unified CoJSON operation router
 * 
 * Single API for all CoJSON operations: cojson({op: ...})
 * Routes operations to modular sub-operation handlers
 * Works directly with CoJSON raw types (CoMap, CoList, CoText, CoStream)
 * 
 * Operations:
 * - query: Query CoValues (all, by ID, by schema, with filters)
 * - create: Create new CoValues
 * - update: Update existing CoValues
 * - delete: Delete CoValue properties or items
 */

import { QueryOperation } from './operations/query.js';
import { CreateOperation } from './operations/create.js';
import { UpdateOperation } from './operations/update.js';
import { DeleteOperation } from './operations/delete.js';
import { GroupOperation } from './operations/group.js';

export class CoJSONEngine {
  constructor(backend) {
    this.backend = backend;
    
    // Initialize modular operations
    this.operations = {
      query: new QueryOperation(this.backend),
      create: new CreateOperation(this.backend),
      update: new UpdateOperation(this.backend),
      delete: new DeleteOperation(this.backend),
      group: new GroupOperation(this.backend)
    };
    
    console.log('[CoJSONEngine] Initialized');
  }
  
  /**
   * Execute a CoJSON operation
   * @param {Object} payload - Operation payload
   * @param {string} payload.op - Operation name (query, create, update, delete, group)
   * @param {Object} payload params - Operation-specific parameters
   * @returns {Promise<any>} Operation result
   */
  async execute(payload) {
    const { op, ...params } = payload;
    
    if (!op) {
      throw new Error('[CoJSONEngine] Operation required: {op: "query|create|update|delete|group"}');
    }
    
    const operation = this.operations[op];
    if (!operation) {
      throw new Error(`[CoJSONEngine] Unknown operation: ${op}`);
    }
    
    // Only log non-query operations (queries are too frequent)
    if (op !== 'query') {
      console.log(`[CoJSONEngine] ${op}`, params);
    }
    
    try {
      const result = await operation.execute(params);
      return result;
    } catch (error) {
      console.error(`[CoJSONEngine] Operation ${op} failed:`, error);
      throw error;
    }
  }
}
