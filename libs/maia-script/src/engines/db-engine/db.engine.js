/**
 * MaiaDB Engine - Unified database operation router
 * 
 * Single API for all data operations: maia.db({op: ...})
 * Routes operations to modular sub-operation handlers
 * Supports swappable backends (IndexedDB, CoJSON CRDT)
 * 
   * Operations:
   * - read: Load configs/schemas/data (always returns reactive store)
   * - create: Create new records
   * - update: Update existing records (data collections)
   * - updateConfig: Update actor configs (system properties)
   * - delete: Delete records
   * - toggle: Toggle boolean field
   * - seed: Flush + seed (dev only)
   */

import { ReadOperation } from './operations/read.js';
import { CreateOperation } from './operations/create.js';
import { UpdateOperation } from './operations/update.js';
import { UpdateConfigOperation } from './operations/update-config.js';
import { DeleteOperation } from './operations/delete.js';
import { ToggleOperation } from './operations/toggle.js';
import { SeedOperation } from './operations/seed.js';

export class DBEngine {
  constructor(backend) {
    this.backend = backend;
    
    // Initialize modular operations (pass dbEngine for validation)
    this.operations = {
      read: new ReadOperation(this.backend),  // Unified reactive read operation
      create: new CreateOperation(this.backend, this),
      update: new UpdateOperation(this.backend, this),
      updateConfig: new UpdateConfigOperation(this.backend),
      delete: new DeleteOperation(this.backend),
      toggle: new ToggleOperation(this.backend),
      seed: new SeedOperation(this.backend)
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
      throw new Error('[DBEngine] Operation required: {op: "read|create|update|updateConfig|delete|seed"}');
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
   * Get schema co-id for a schema name (e.g., 'actor', 'view', 'subscriptions')
   * Resolves human-readable schema names to co-ids via coIdRegistry
   * @param {string} schemaName - Schema name (e.g., 'actor', 'view', 'subscriptions', 'inbox', 'vibe')
   * @returns {Promise<string|null>} Schema co-id (co_z...) or null if not found
   */
  async getSchemaCoId(schemaName) {
    // Try @schema/... format first (most common)
    const schemaKey = `@schema/${schemaName}`;
    const coId = await this.backend.resolveHumanReadableKey(schemaKey);
    if (coId) {
      return coId;
    }
    
    // Fallback: try just the schema name
    return await this.backend.resolveHumanReadableKey(schemaName);
  }
  
  /**
   * Resolve a human-readable ID to a co-id
   * @param {string} humanReadableId - Human-readable ID (e.g., '@vibe/todos', 'vibe/vibe')
   * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
   */
  async resolveCoId(humanReadableId) {
    return await this.backend.resolveHumanReadableKey(humanReadableId);
  }
}
