/**
 * DBAdapter Interface
 * 
 * Defines the interface that all database backends must implement.
 * This allows operations to work with any backend implementation (IndexedDB, CoJSON, etc.)
 * 
 * All backends must implement these methods to work with the unified operations layer.
 */

/**
 * DBAdapter - Interface for database backends
 * 
 * All backends must implement these methods:
 * - read(): Read data (single item, collection, or batch)
 * - create(): Create new records
 * - update(): Update existing records (unified for data + configs)
 * - delete(): Delete records
 * - getRawRecord(): Get raw stored data without normalization (for validation)
 * 
 * Optional methods (backend-specific):
 * - seed(): Seed database with initial data (CoJSON only)
 * - init(): Initialize backend connection
 * 
 * Note: All schema/co-value resolution uses the universal resolve() API from @MaiaOS/db.
 * Use resolve() directly: import { resolve } from '@MaiaOS/db';
 */
export class DBAdapter {
  /**
   * Read data from database
   * @param {string} schema - Schema co-id (co_z...)
   * @param {string} [key] - Specific key (co-id) for single item
   * @param {string[]} [keys] - Array of co-ids for batch reads
   * @param {Object} [filter] - Filter criteria for collection queries
   * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) that hold current value and notify on updates
   */
  async read(schema, key, keys, filter) {
    throw new Error('[DBAdapter] read() must be implemented by backend');
  }

  /**
   * Create new record
   * @param {string} schema - Schema co-id (co_z...) for data collections
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} Created record with generated co-id
   */
  async create(schema, data) {
    throw new Error('[DBAdapter] create() must be implemented by backend');
  }

  /**
   * Update existing record (unified for data collections and configs)
   * @param {string} schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} id - Record co-id to update
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  async update(schema, id, data) {
    throw new Error('[DBAdapter] update() must be implemented by backend');
  }

  /**
   * Delete record
   * @param {string} schema - Schema co-id (co_z...)
   * @param {string} id - Record co-id to delete
   * @returns {Promise<boolean>} true if deleted successfully
   */
  async delete(schema, id) {
    throw new Error('[DBAdapter] delete() must be implemented by backend');
  }

  /**
   * Get raw record from database (without normalization)
   * Used for validation - returns stored data as-is (with $schema metadata, without id)
   * @param {string} id - Record co-id
   * @returns {Promise<Object|null>} Raw stored record or null if not found
   */
  async getRawRecord(id) {
    throw new Error('[DBAdapter] getRawRecord() must be implemented by backend');
  }

  /**
   * Seed database with configs, schemas, and initial data (optional - backend-specific)
   * @param {Object} configs - Config registry
   * @param {Object} schemas - Schema definitions
   * @param {Object} data - Initial application data
   * @returns {Promise<void>}
   */
  async seed(configs, schemas, data) {
    throw new Error('[DBAdapter] seed() is optional - backend may not implement this');
  }
}
