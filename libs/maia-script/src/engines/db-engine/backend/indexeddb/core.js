/**
 * IndexedDB Core Operations
 * 
 * Core IndexedDB operations: initialization, utilities, and store management
 */

/**
 * Initialize IndexedDB connection
 * @param {IndexedDBBackend} backend - Backend instance
 * @returns {Promise<void>}
 */
export async function init(backend) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(backend.dbName, backend.version);
    
    request.onerror = () => {
      console.error('[IndexedDBBackend] Failed to open database:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      backend.db = request.result;
      resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('configs')) {
        db.createObjectStore('configs', { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains('schemas')) {
        db.createObjectStore('schemas', { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains('coIdRegistry')) {
        db.createObjectStore('coIdRegistry', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Promisify IndexedDB request
 * @param {IDBRequest} request - IndexedDB request
 * @returns {Promise<any>}
 */
export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get object store name from schema reference
 * @param {string} schema - Schema reference
 * @returns {string} Store name ('configs', 'schemas', or 'data')
 */
export function getStoreName(schema) {
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
 * @param {IndexedDBBackend} backend - Backend instance
 * @param {Array<string>} storeNames - Optional array of store names to flush. Defaults to all stores.
 * @returns {Promise<void>}
 */
export async function flush(backend, storeNames = ['configs', 'schemas', 'data']) {
  const transaction = backend.db.transaction(storeNames, 'readwrite');
  
  for (const storeName of storeNames) {
    const store = transaction.objectStore(storeName);
    await promisifyRequest(store.clear());
  }
}
