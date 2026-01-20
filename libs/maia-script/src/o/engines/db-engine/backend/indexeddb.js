/**
 * IndexedDB Backend - Storage implementation for MaiaDB
 * 
 * Provides persistent storage using browser's IndexedDB API
 * Supports reactive subscriptions via observer pattern
 * 
 * Object Stores:
 * - configs: All .maia configs (actors, views, styles, states, contexts, interfaces, vibes)
 * - schemas: JSON Schema definitions  
 * - data: Application data collections (todos, notes, etc.)
 */

export class IndexedDBBackend {
  constructor() {
    this.db = null;
    this.dbName = 'maiaos';
    this.version = 1;
    
    // Observers for reactive subscriptions
    // Map: schema -> Set<{filter, callback}>
    this.observers = new Map();
    
    console.log('[IndexedDBBackend] Initialized');
  }
  
  /**
   * Initialize IndexedDB connection
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error('[IndexedDBBackend] Failed to open database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
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
      };
    });
  }
  
  /**
   * Seed database with configs, schemas, and initial data
   * @param {Object} configs - Config registry {vibe, styles, actors, views, contexts, states, interfaces}
   * @param {Object} schemas - Schema definitions
   * @param {Object} data - Initial application data {todos: [], ...}
   * @returns {Promise<void>}
   */
  async seed(configs, schemas, data) {
    console.log('[IndexedDBBackend] Starting seed...');
    
    // Flush configs and schemas only (preserve user data)
    await this.flush(['configs', 'schemas']);
    
    // Seed configs
    await this._seedConfigs(configs);
    
    // Seed schemas
    await this._seedSchemas(schemas);
    
    // Seed initial data ONLY if data store is empty
    const hasExistingData = await this._hasExistingData();
    if (!hasExistingData) {
      console.log('[IndexedDBBackend] No existing data, seeding initial data...');
      await this._seedData(data);
    } else {
      console.log('[IndexedDBBackend] Existing data found, skipping data seed to preserve user data');
    }
    
    console.log('[IndexedDBBackend] Seed complete!');
  }
  
  /**
   * Check if data store has any existing records
   * @private
   * @returns {Promise<boolean>}
   */
  async _hasExistingData() {
    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    const request = store.getAllKeys();
    const keys = await this._promisifyRequest(request);
    
    return keys && keys.length > 0;
  }
  
  /**
   * Flush data stores (dev only)
   * @param {Array<string>} storeNames - Optional array of store names to flush. Defaults to all stores.
   * @returns {Promise<void>}
   */
  async flush(storeNames = ['configs', 'schemas', 'data']) {
    console.log(`[IndexedDBBackend] Flushing stores:`, storeNames);
    
    const transaction = this.db.transaction(storeNames, 'readwrite');
    
    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName);
      await this._promisifyRequest(store.clear());
    }
    
    console.log('[IndexedDBBackend] Stores flushed');
  }
  
  /**
   * Seed configs into database
   * @private
   */
  async _seedConfigs(configs) {
    const transaction = this.db.transaction(['configs'], 'readwrite');
    const store = transaction.objectStore('configs');
    
    let count = 0;
    
    // Seed vibe (use normalized key from $id)
    if (configs.vibe) {
      // Extract vibe name from $id: "vibe_todos_001" -> "todos"
      const vibeId = configs.vibe.$id || 'default';
      const vibeName = vibeId.replace('vibe_', '').replace(/_\d+$/, ''); // "vibe_todos_001" -> "todos"
      
      await this._promisifyRequest(store.put({
        key: `@schema/vibe:${vibeName}`,
        value: configs.vibe
      }));
      count++;
    }
    
    // Seed styles
    if (configs.styles) {
      for (const [name, style] of Object.entries(configs.styles)) {
        await this._promisifyRequest(store.put({
          key: `@schema/style:${name}`,
          value: style
        }));
        count++;
      }
    }
    
    // Seed actors
    if (configs.actors) {
      for (const [path, actor] of Object.entries(configs.actors)) {
        await this._promisifyRequest(store.put({
          key: `@schema/actor:${path}`,
          value: actor
        }));
        count++;
      }
    }
    
    // Seed views
    if (configs.views) {
      for (const [path, view] of Object.entries(configs.views)) {
        await this._promisifyRequest(store.put({
          key: `@schema/view:${path}`,
          value: view
        }));
        count++;
      }
    }
    
    // Seed contexts
    if (configs.contexts) {
      for (const [path, context] of Object.entries(configs.contexts)) {
        await this._promisifyRequest(store.put({
          key: `@schema/context:${path}`,
          value: context
        }));
        count++;
      }
    }
    
    // Seed states
    if (configs.states) {
      for (const [path, state] of Object.entries(configs.states)) {
        await this._promisifyRequest(store.put({
          key: `@schema/state:${path}`,
          value: state
        }));
        count++;
      }
    }
    
    // Seed interfaces
    if (configs.interfaces) {
      for (const [path, interfaceDef] of Object.entries(configs.interfaces)) {
        await this._promisifyRequest(store.put({
          key: `@schema/interface:${path}`,
          value: interfaceDef
        }));
        count++;
      }
    }
    
    // Seed tool definitions
    if (configs.tool) {
      for (const [path, toolDef] of Object.entries(configs.tool)) {
        await this._promisifyRequest(store.put({
          key: `@schema/tool:${path}`,
          value: toolDef
        }));
        count++;
      }
    }
    
    console.log(`[IndexedDBBackend] Seeded ${count} configs`);
  }
  
  /**
   * Seed schemas into database
   * @private
   */
  async _seedSchemas(schemas) {
    const transaction = this.db.transaction(['schemas'], 'readwrite');
    const store = transaction.objectStore('schemas');
    
    let count = 0;
    
    for (const [name, schema] of Object.entries(schemas)) {
      await this._promisifyRequest(store.put({
        key: `@schema/${name}`,
        value: schema
      }));
      count++;
    }
    
    console.log(`[IndexedDBBackend] Seeded ${count} schemas`);
  }
  
  /**
   * Seed initial data into database
   * @private
   */
  async _seedData(data) {
    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    
    let count = 0;
    
    for (const [collectionName, collection] of Object.entries(data)) {
      await this._promisifyRequest(store.put({
        key: `@schema/${collectionName}`,
        value: Array.isArray(collection) ? collection : []
      }));
      count++;
    }
    
    console.log(`[IndexedDBBackend] Seeded ${count} data collections`);
  }
  
  /**
   * Get single item by schema + key
   * @param {string} schema - Schema reference (@schema/actor, @schema/todos)
   * @param {string} key - Item key (e.g., 'vibe/vibe')
   * @returns {Promise<any>} Item value
   */
  async get(schema, key) {
    const storeName = this._getStoreName(schema);
    const fullKey = `${schema}:${key}`;
    
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(fullKey);
    
    const result = await this._promisifyRequest(request);
    return result?.value;
  }
  
  /**
   * Query collection (optionally with filter)
   * @param {string} schema - Schema reference (@schema/todos)
   * @param {Object} filter - Filter criteria {field: value} or null
   * @returns {Promise<Array>} Array of items
   */
  async query(schema, filter = null) {
    const storeName = this._getStoreName(schema);
    const key = schema;
    
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    const result = await this._promisifyRequest(request);
    let collection = result?.value || [];
    
    // Apply filter if provided
    if (filter && collection.length > 0) {
      collection = this._applyFilter(collection, filter);
    }
    
    return collection;
  }
  
  /**
   * Create new record
   * @param {string} schema - Schema reference (@schema/todos)
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} Created record with generated ID
   */
  async create(schema, data) {
    const storeName = 'data'; // Only data store supports create
    const key = schema;
    
    // Generate ID
    const id = Date.now().toString();
    const record = { id, ...data };
    
    // Get existing collection
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    const result = await this._promisifyRequest(request);
    
    const collection = result?.value || [];
    collection.push(record);
    
    // Save updated collection
    await this._promisifyRequest(store.put({
      key,
      value: collection
    }));
    
    // CRITICAL: Wait for transaction to commit before notifying observers
    await transaction.complete; // transaction.complete is already a Promise
    console.log(`[IndexedDBBackend] Transaction committed for ${schema}`);
    
    console.log(`[IndexedDBBackend] Created record in ${schema}:`, record);
    
    // Notify observers with updated collection (avoid re-query race condition)
    this.notifyWithData(schema, collection);
    
    return record;
  }
  
  /**
   * Update existing record
   * @param {string} schema - Schema reference (@schema/todos)
   * @param {string} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  async update(schema, id, data) {
    const storeName = 'data';
    const key = schema;
    
    // Get existing collection
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    const result = await this._promisifyRequest(request);
    
    const collection = result?.value || [];
    const index = collection.findIndex(item => item.id === id);
    
    if (index === -1) {
      throw new Error(`[IndexedDBBackend] Record not found: ${id}`);
    }
    
    // Update record
    collection[index] = { ...collection[index], ...data };
    
    // Save updated collection
    await this._promisifyRequest(store.put({
      key,
      value: collection
    }));
    
    // CRITICAL: Wait for transaction to commit before notifying observers
    await transaction.complete; // transaction.complete is already a Promise
    console.log(`[IndexedDBBackend] Transaction committed for ${schema}`);
    
    console.log(`[IndexedDBBackend] Updated record in ${schema}:`, collection[index]);
    
    // Notify observers with updated collection (avoid re-query race condition)
    this.notifyWithData(schema, collection);
    
    return collection[index];
  }
  
  /**
   * Delete record
   * @param {string} schema - Schema reference (@schema/todos)
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} true if deleted
   */
  async delete(schema, id) {
    const storeName = 'data';
    const key = schema;
    
    // Get existing collection
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    const result = await this._promisifyRequest(request);
    
    const collection = result?.value || [];
    const index = collection.findIndex(item => item.id === id);
    
    if (index === -1) {
      throw new Error(`[IndexedDBBackend] Record not found: ${id}`);
    }
    
    // Remove record
    collection.splice(index, 1);
    
    // Save updated collection
    await this._promisifyRequest(store.put({
      key,
      value: collection
    }));
    
    // CRITICAL: Wait for transaction to commit before notifying observers
    await transaction.complete; // transaction.complete is already a Promise
    console.log(`[IndexedDBBackend] Transaction committed for ${schema}`);
    
    console.log(`[IndexedDBBackend] Deleted record from ${schema}:`, id);
    
    // Notify observers with updated collection (avoid re-query race condition)
    this.notifyWithData(schema, collection);
    
    return true;
  }
  
  /**
   * Subscribe to collection changes (reactive)
   * @param {string} schema - Schema reference (@schema/todos)
   * @param {Object} filter - Filter criteria or null
   * @param {Function} callback - Called when collection changes (data) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(schema, filter, callback) {
    // Silent - SubscriptionEngine handles logging
    
    if (!this.observers.has(schema)) {
      this.observers.set(schema, new Set());
    }
    
    const observer = { filter, callback };
    this.observers.get(schema).add(observer);
    
    // Immediately call callback with current data (silent - SubscriptionEngine handles logging)
    this.query(schema, filter).then(data => {
      callback(data);
    });
    
    // Return unsubscribe function
    return () => {
      console.log(`[IndexedDBBackend] Unsubscribing from ${schema}`);
      const observers = this.observers.get(schema);
      if (observers) {
        observers.delete(observer);
        if (observers.size === 0) {
          this.observers.delete(schema);
        }
      }
    };
  }
  
  /**
   * Notify all observers with updated collection data (avoids re-query race condition)
   * @param {string} schema - Schema reference
   * @param {Array} updatedCollection - The updated collection data
   */
  notifyWithData(schema, updatedCollection) {
    const observers = this.observers.get(schema);
    if (!observers || observers.size === 0) {
      return; // No observers, silent return
    }
    
    // Silent - SubscriptionEngine handles logging
    observers.forEach((observer) => {
      // Apply filter to updated collection
      const filteredData = observer.filter ? this._applyFilter(updatedCollection, observer.filter) : updatedCollection;
      observer.callback(filteredData);
    });
  }
  
  /**
   * Notify all observers of schema changes (queries database)
   * @param {string} schema - Schema reference
   */
  notify(schema) {
    console.log(`[IndexedDBBackend] Notifying observers for ${schema} (re-querying)`);
    
    const observers = this.observers.get(schema);
    if (!observers) {
      console.log(`[IndexedDBBackend] No observers found for ${schema}`);
      return;
    }
    
    console.log(`[IndexedDBBackend] Found ${observers.size} observer(s) for ${schema}`);
    
    observers.forEach((observer, index) => {
      console.log(`[IndexedDBBackend] Calling observer ${index + 1} for ${schema}`, { filter: observer.filter });
      this.query(schema, observer.filter).then(data => {
        console.log(`[IndexedDBBackend] Observer callback data for ${schema}:`, { dataLength: data?.length });
        observer.callback(data);
      });
    });
  }
  
  /**
   * Apply filter to collection
   * @private
   */
  _applyFilter(collection, filter) {
    return collection.filter(item => {
      for (const [field, value] of Object.entries(filter)) {
        if (item[field] !== value) {
          return false;
        }
      }
      return true;
    });
  }
  
  /**
   * Get object store name from schema reference
   * @private
   * 
   * Logic:
   * - Config types (actor, view, style, state, context, interface, vibe, tool) → 'configs' store
   * - Schema definitions (when explicitly querying schema metadata) → 'schemas' store
   * - Everything else (application data like todos, notes) → 'data' store
   */
  _getStoreName(schema) {
    // Check if it's a config type (used with key parameter for loading configs)
    // Examples: @schema/actor:vibe/vibe, @schema/view:list/list
    const configTypes = ['actor', 'view', 'style', 'state', 'context', 'interface', 'vibe', 'tool'];
    
    for (const configType of configTypes) {
      // Match pattern: @schema/{configType}:key or contains /{configType}/
      if (schema.includes(`@schema/${configType}`) || schema.includes(`/${configType}/`)) {
        return 'configs';
      }
    }
    
    // Schema definitions (not commonly queried, but supported)
    // Only return 'schemas' if it's explicitly querying schema metadata (rare)
    // For now, we don't query schema definitions, so this path is unused
    // if (schema === '@schema/schema' || schema.startsWith('@schema/schema:')) {
    //   return 'schemas';
    // }
    
    // Everything else is application data (@schema/todos, @schema/notes, etc.)
    return 'data';
  }
  
  /**
   * Get schema definition from schemas store
   * @param {string} schemaKey - Schema key (e.g., '@schema/actor', '@schema/data/todos')
   * @returns {Promise<Object|null>} Schema object or null if not found
   */
  async getSchema(schemaKey) {
    try {
      const transaction = this.db.transaction(['schemas'], 'readonly');
      const store = transaction.objectStore('schemas');
      const request = store.get(schemaKey);
      const result = await this._promisifyRequest(request);
      return result?.value || null;
    } catch (error) {
      console.warn(`[IndexedDBBackend] Error loading schema ${schemaKey}:`, error);
      return null;
    }
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
}
