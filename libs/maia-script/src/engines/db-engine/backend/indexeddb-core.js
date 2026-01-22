/**
 * IndexedDB Core Operations
 * 
 * Core IndexedDB operations: initialization, CRUD operations, and utilities
 */

export class IndexedDBCore {
  constructor(backend) {
    this.backend = backend;
  }

  /**
   * Initialize IndexedDB connection
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.backend.dbName, this.backend.version);
      
      request.onerror = () => {
        console.error('[IndexedDBBackend] Failed to open database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.backend.db = request.result;
        console.log('[IndexedDBBackend] Database opened successfully');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('configs')) {
          db.createObjectStore('configs', { keyPath: 'key' });
          console.log('[IndexedDBBackend] Created "configs" object store');
        }
        
        if (!db.objectStoreNames.contains('schemas')) {
          db.createObjectStore('schemas', { keyPath: 'key' });
          console.log('[IndexedDBBackend] Created "schemas" object store');
        }
        
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'key' });
          console.log('[IndexedDBBackend] Created "data" object store');
        }
        
        if (!db.objectStoreNames.contains('coIdRegistry')) {
          db.createObjectStore('coIdRegistry', { keyPath: 'key' });
          console.log('[IndexedDBBackend] Created "coIdRegistry" object store');
        }
      };
    });
  }

  /**
   * Promisify IndexedDB request
   * @private
   */
  _promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Determine which object store to use based on schema
   * @private
   * @param {string} schema - Schema reference
   * @returns {string} Store name ('configs', 'schemas', or 'data')
   */
  _getStoreName(schema) {
    // Check if it's a config type (used with key parameter for loading configs)
    // Examples: @schema/actor:vibe/vibe, @schema/view:list/list
    const configTypes = ['actor', 'view', 'style', 'state', 'context', 'interface', 'vibe', 'tool', 'subscriptions', 'inbox'];
    
    for (const configType of configTypes) {
      // Match pattern: @schema/{configType}:key or contains /{configType}/
      if (schema.includes(`@schema/${configType}`) || schema.includes(`/${configType}/`)) {
        return 'configs';
      }
    }
    
    // Everything else is application data (@schema/todos, @schema/notes, etc.)
    return 'data';
  }

  /**
   * Flush data stores (dev only)
   * @param {Array<string>} storeNames - Optional array of store names to flush. Defaults to all stores.
   * @returns {Promise<void>}
   */
  async flush(storeNames = ['configs', 'schemas', 'data']) {
    console.log(`[IndexedDBBackend] Flushing stores:`, storeNames);
    
    const transaction = this.backend.db.transaction(storeNames, 'readwrite');
    
    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName);
      await this._promisifyRequest(store.clear());
    }
    
    await transaction.complete;
    console.log(`[IndexedDBBackend] Flushed ${storeNames.length} stores`);
  }
}
