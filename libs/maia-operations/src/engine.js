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
 */

import { ReadOperation } from './operations/read.js';
import { CreateOperation } from './operations/create.js';
import { UpdateOperation } from './operations/update.js';
import { DeleteOperation } from './operations/delete.js';
import { SeedOperation } from './operations/seed.js';
import { SchemaOperation } from './operations/schema.js';
import { ResolveOperation } from './operations/resolve.js';
import { PushOperation } from './operations/push.js';
import { ProcessInboxOperation } from './operations/process-inbox.js';

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
    
    // Initialize modular operations (pass dbEngine for validation and inter-operation calls)
    this.operations = {
      read: new ReadOperation(this.backend),  // Unified reactive read operation
      create: new CreateOperation(this.backend, this),
      update: new UpdateOperation(this.backend, this, evaluator),  // Unified for data + configs, optional evaluator
      delete: new DeleteOperation(this.backend),
      seed: new SeedOperation(this.backend),
      schema: new SchemaOperation(this.backend, this),  // Schema loading operation (needs dbEngine for resolve operation)
      resolve: new ResolveOperation(this.backend),  // Co-id resolution operation
      push: new PushOperation(this.backend, this),  // CoStream append operation
      processInbox: new ProcessInboxOperation(this.backend, this)  // Inbox processing with session-based watermarks
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
      throw new Error('[DBEngine] Operation required: {op: "read|create|update|delete|seed|schema|resolve"}');
    }
    
    const operation = this.operations[op];
    if (!operation) {
      throw new Error(`[DBEngine] Unknown operation: ${op}`);
    }
    
    try {
      const result = await operation.execute(params);
      return result;
    } catch (error) {
      console.error(`[DBEngine] Operation ${op} failed:`, error);
      throw error;
    }
  }
  
  /**
   * Resolve a human-readable ID to a co-id
   * DEPRECATED: This method should only be used during seeding. At runtime, all IDs should already be co-ids.
   * @deprecated Use co-ids directly at runtime. This method is only for seeding/backward compatibility.
   * @param {string} humanReadableId - Human-readable ID (e.g., '@vibe/todos', 'vibe/vibe')
   * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
   */
  async resolveCoId(humanReadableId) {
    console.warn(`[DBEngine] resolveCoId() called at runtime with: ${humanReadableId}. This should only be used during seeding. At runtime, all IDs should already be co-ids.`);
    return await this.execute({op: 'resolve', humanReadableKey: humanReadableId});
  }
}
