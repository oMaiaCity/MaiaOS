/**
 * MaiaDB Engine - Unified database operation router
 * 
 * Single API for all data operations: maia.db({op: ...})
 * Routes operations to modular sub-operation handlers
 * Supports swappable backends (IndexedDB, CoJSON CRDT)
 * 
 * Operations:
 * - query: Load configs/schemas/data (reactive if callback provided)
 * - create: Create new records
 * - update: Update existing records
 * - delete: Delete records
 * - toggle: Toggle boolean field
 * - seed: Flush + seed (dev only)
 */

import { QueryOperation } from './operations/query.js';
import { CreateOperation } from './operations/create.js';
import { UpdateOperation } from './operations/update.js';
import { DeleteOperation } from './operations/delete.js';
import { ToggleOperation } from './operations/toggle.js';
import { SeedOperation } from './operations/seed.js';

export class DBEngine {
  constructor(backend) {
    this.backend = backend;
    
    // Initialize modular operations
    this.operations = {
      query: new QueryOperation(this.backend),
      create: new CreateOperation(this.backend),
      update: new UpdateOperation(this.backend),
      delete: new DeleteOperation(this.backend),
      toggle: new ToggleOperation(this.backend),
      seed: new SeedOperation(this.backend)
    };
    
    console.log('[DBEngine] Initialized with backend:', backend.constructor.name);
  }
  
  /**
   * Execute a database operation
   * @param {Object} payload - Operation payload
   * @param {string} payload.op - Operation name (query, create, update, delete, seed)
   * @param {Object} payload params - Operation-specific parameters
   * @returns {Promise<any>} Operation result
   */
  async execute(payload) {
    const { op, ...params } = payload;
    
    if (!op) {
      throw new Error('[DBEngine] Operation required: {op: "query|create|update|delete|seed"}');
    }
    
    const operation = this.operations[op];
    if (!operation) {
      throw new Error(`[DBEngine] Unknown operation: ${op}`);
    }
    
    // Only log non-query operations (queries are too frequent)
    if (op !== 'query') {
      console.log(`[DBEngine] ${op}`, params);
    }
    
    try {
      const result = await operation.execute(params);
      return result;
    } catch (error) {
      console.error(`[DBEngine] Operation ${op} failed:`, error);
      throw error;
    }
  }
}
