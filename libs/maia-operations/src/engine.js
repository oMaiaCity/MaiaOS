/**
 * DBEngine - Unified database operation router
 * 
 * Single API for all data operations: maia.db({op: ...})
 * Routes operations to modular sub-operation handlers
 * Supports swappable backends (IndexedDB, CoJSON CRDT)
 * 
 * Operations:
 * - read: Load configs/schemas/data (always returns reactive store)
 * - create: Create new records
 * - update: Update existing records (unified for data collections and configs)
 * - delete: Delete records
 * - seed: Flush + seed (dev only)
 * - schema: Load schema definitions by co-id, schema name, or from CoValue headerMeta
 * - resolve: Resolve human-readable keys to co-ids
 * - createSpark: Create new Spark (group reference)
 * - readSpark: Read Spark(s)
 * - updateSpark: Update Spark
 * - deleteSpark: Delete Spark
 */

import {
  readOperation,
  createOperation,
  updateOperation,
  deleteOperation,
  seedOperation,
  schemaOperation,
  resolveOperation,
  appendOperation,
  processInboxOperation
} from './operations.js';
import { createErrorResult, createErrorEntry, isPermissionError } from './operation-result.js';
import {
  createSparkOperation,
  readSparkOperation,
  updateSparkOperation,
  deleteSparkOperation,
  addSparkMemberOperation,
  removeSparkMemberOperation,
  addSparkParentGroupOperation,
  removeSparkParentGroupOperation,
  getSparkMembersOperation,
  updateSparkMemberRoleOperation
} from './operations/spark-operations.js';

export class DBEngine {
  /**
   * Create a new DBEngine instance
   * @param {DBAdapter} backend - Backend adapter instance (must implement DBAdapter interface)
   * @param {Object} [options] - Optional configuration
   * @param {Object} [options.evaluator] - Optional MaiaScript evaluator for expression evaluation in updates
   */
  constructor(backend, options = {}) {
    this.backend = backend;
    const { evaluator } = options;
    
    // Pass dbEngine to backend for runtime schema validation in create functions
    if (backend && typeof backend.setDbEngine === 'function') {
      backend.setDbEngine(this);
    } else if (backend && backend.constructor.name === 'CoJSONBackend') {
      // CoJSONBackend stores dbEngine in constructor
      backend.dbEngine = this;
    }
    
    // Initialize operations as execute wrappers (maintains same interface)
    this.operations = {
      read: { execute: (params) => readOperation(this.backend, params) },
      create: { execute: (params) => createOperation(this.backend, this, params) },
      update: { execute: (params) => updateOperation(this.backend, this, evaluator, params) },
      delete: { execute: (params) => deleteOperation(this.backend, this, params) },
      seed: { execute: (params) => seedOperation(this.backend, params) },
      schema: { execute: (params) => schemaOperation(this.backend, this, params) },
      resolve: { execute: (params) => resolveOperation(this.backend, params) },
      append: { execute: (params) => appendOperation(this.backend, this, params) },
      push: { execute: (params) => appendOperation(this.backend, this, { ...params, cotype: 'costream' }) },
      processInbox: { execute: (params) => processInboxOperation(this.backend, this, params) },
      createSpark: { execute: (params) => createSparkOperation(this.backend, this, params) },
      readSpark: { execute: (params) => readSparkOperation(this.backend, params) },
      updateSpark: { execute: (params) => updateSparkOperation(this.backend, this, params) },
      deleteSpark: { execute: (params) => deleteSparkOperation(this.backend, this, params) },
      addSparkMember: { execute: (params) => addSparkMemberOperation(this.backend, this, params) },
      removeSparkMember: { execute: (params) => removeSparkMemberOperation(this.backend, this, params) },
      addSparkParentGroup: { execute: (params) => addSparkParentGroupOperation(this.backend, this, params) },
      removeSparkParentGroup: { execute: (params) => removeSparkParentGroupOperation(this.backend, this, params) },
      getSparkMembers: { execute: (params) => getSparkMembersOperation(this.backend, params) },
      updateSparkMemberRole: { execute: (params) => updateSparkMemberRoleOperation(this.backend, this, params) }
    };
  }
  
  /**
   * Execute a database operation
   * @param {Object} payload - Operation payload
   * @param {string} payload.op - Operation name (read, create, update, delete, seed)
   * @param {Object} payload params - Operation-specific parameters
   * @returns {Promise<any>} Operation result
   */
  async execute(payload) {
    const { op, ...params } = payload;
    
    if (!op) {
      throw new Error('[DBEngine] Operation required: {op: "read|create|update|delete|seed|schema|resolve|append|push|createSpark|readSpark|updateSpark|deleteSpark|addSparkMember|removeSparkMember|addSparkParentGroup|removeSparkParentGroup|getSparkMembers|updateSparkMemberRole"}');
    }
    
    // Debug logging removed - too verbose
    
    // Route 'push' operation to 'append' with cotype='costream'
    if (op === 'push') {
      return await this.operations.append.execute({ ...params, cotype: 'costream' });
    }
    
    const operation = this.operations[op];
    if (!operation) {
      throw new Error(`[DBEngine] Unknown operation: ${op}`);
    }
    
    const WRITE_OPS = new Set(['create', 'update', 'delete', 'append', 'push', 'seed', 'addSparkMember', 'removeSparkMember']);
    try {
      const result = await operation.execute(params);
      return result;
    } catch (error) {
      console.error(`[DBEngine] Operation ${op} failed:`, error);
      if (WRITE_OPS.has(op)) {
        const errors = [isPermissionError(error)
          ? createErrorEntry('permission', error.message)
          : createErrorEntry('schema', error.message)];
        return createErrorResult(errors, { op });
      }
      throw error;
    }
  }
  
  /**
   * Resolve a human-readable ID to a co-id
   * DEPRECATED: This method should only be used during seeding. At runtime, all IDs should already be co-ids.
   * @deprecated Use co-ids directly at runtime. This method is only for seeding/backward compatibility.
   * @param {string} humanReadableId - Human-readable ID (e.g., '@maia/vibe/todos', 'vibe/vibe')
   * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
   */
}
