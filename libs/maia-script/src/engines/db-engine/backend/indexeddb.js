/**
 * IndexedDB Backend - Storage implementation for MaiaDB
 * 
 * Provides persistent storage using browser's IndexedDB API
 * Supports reactive subscriptions via observer pattern
 * 
 * Object Stores:
 * - configs: All .maia configs (actors, views, styles, states, contexts, interfaces, vibes)
 *   - PRIMARY KEYS: co-ids only (co_z...)
 * - schemas: JSON Schema definitions  
 *   - PRIMARY KEYS: co-ids only (co_z...)
 * - data: Application data collections (todos, notes, etc.)
 *   - PRIMARY KEYS: co-ids only (co_z...)
 * - coIdRegistry: Human-readable ID → co-id mappings
 *   - Used for lookups: resolves human-readable IDs (e.g., "@schema/vibe:todos") to co-ids
 *   - PRIMARY KEYS: human-readable IDs (e.g., "@schema/vibe:todos", "todos", "vibe/vibe")
 * 
 * Architecture:
 * - Content stores (configs, schemas, data) contain ONLY co-id primary keys
 * - Human-readable → co-id mappings stored ONLY in coIdRegistry
 * - All lookups resolve human-readable keys via coIdRegistry before fetching content
 */

export class IndexedDBBackend {
  constructor() {
    this.db = null;
    this.dbName = 'maiaos';
    this.version = 2; // Incremented to create coIdRegistry store
    
    // Observers for reactive subscriptions
    // Map: schema -> Set<{filter, callback}>
    this.observers = new Map();
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
   * Seed database with configs, schemas, and initial data
   * Two-phase seeding process with co-id generation and resolution
   * @param {Object} configs - Config registry {vibe, styles, actors, views, contexts, states, interfaces}
   * @param {Object} schemas - Schema definitions
   * @param {Object} data - Initial application data {todos: [], ...}
   * @returns {Promise<void>}
   */
  async seed(configs, schemas, data) {
    // Import co-id generator and transformer
    const { generateCoId, CoIdRegistry } = 
      await import('@MaiaOS/schemata/co-id-generator');
    const { transformSchemaForSeeding, transformInstanceForSeeding, validateNoNestedCoTypes } = 
      await import('@MaiaOS/schemata/schema-transformer');
    
    const coIdRegistry = new CoIdRegistry();
    
    // Simple seeding: flush everything and reseed
    // TODO: Add smart seeding later to preserve data across sessions
    await this.flush(['configs', 'schemas', 'data', 'coIdRegistry']);
    
    // Deduplicate schemas by $id (same schema may be registered under multiple keys)
    const uniqueSchemasBy$id = new Map();
    for (const [name, schema] of Object.entries(schemas)) {
      const schemaKey = schema.$id || `@schema/${name}`;
      // Only keep first occurrence of each $id (deduplicate)
      if (!uniqueSchemasBy$id.has(schemaKey)) {
        uniqueSchemasBy$id.set(schemaKey, { name, schema });
      }
    }
    
    // Helper function to find all $co references in a schema (recursively)
    const findCoReferences = (obj, visited = new Set()) => {
      const refs = new Set();
      if (!obj || typeof obj !== 'object' || visited.has(obj)) {
        return refs;
      }
      visited.add(obj);
      
      // Check if this object has a $co keyword
      if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('@schema/')) {
        refs.add(obj.$co);
      }
      
      // Recursively check all properties
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === 'object') {
                const itemRefs = findCoReferences(item, visited);
                itemRefs.forEach(ref => refs.add(ref));
              }
            }
          } else {
            const nestedRefs = findCoReferences(value, visited);
            nestedRefs.forEach(ref => refs.add(ref));
          }
        }
      }
      
      return refs;
    };
    
    // Build dependency map: schemaKey -> Set of referenced schema keys
    const schemaDependencies = new Map();
    for (const [schemaKey, { schema }] of uniqueSchemasBy$id) {
      const refs = findCoReferences(schema);
      schemaDependencies.set(schemaKey, refs);
    }
    
    // Sort schemas by dependency order (leaf schemas first, then composite schemas)
    // Use topological sort to handle dependencies correctly
    const sortedSchemaKeys = [];
    const processed = new Set();
    const processing = new Set(); // Detect circular dependencies
    
    const visitSchema = (schemaKey) => {
      if (processed.has(schemaKey)) {
        return; // Already processed
      }
      if (processing.has(schemaKey)) {
        // Circular dependency detected - this is OK for self-references (e.g., actor -> actor)
        // Just continue processing
        return;
      }
      
      processing.add(schemaKey);
      
      // Process dependencies first
      const deps = schemaDependencies.get(schemaKey) || new Set();
      for (const dep of deps) {
        // Only process if it's a schema we're seeding (starts with @schema/)
        if (dep.startsWith('@schema/') && uniqueSchemasBy$id.has(dep)) {
          visitSchema(dep);
        }
      }
      
      processing.delete(schemaKey);
      processed.add(schemaKey);
      sortedSchemaKeys.push(schemaKey);
    };
    
    // Visit all schemas
    for (const schemaKey of uniqueSchemasBy$id.keys()) {
      visitSchema(schemaKey);
    }
    
    // Phase 1: Generate co-ids for all unique schemas, build co-id map
    const schemaCoIdMap = new Map();
    
    for (const schemaKey of sortedSchemaKeys) {
      const { schema } = uniqueSchemasBy$id.get(schemaKey);
      // Generate co-id for schema
      const schemaCoId = generateCoId(schema);
      
      schemaCoIdMap.set(schemaKey, schemaCoId);
      coIdRegistry.register(schemaKey, schemaCoId);
    }
    
    // Phase 2: Transform all schemas (replace human-readable refs with co-ids)
    // Transform in dependency order to ensure referenced schemas are already transformed
    const transformedSchemas = {};
    const transformedSchemasByKey = new Map(); // Map by schemaKey for lookup
    
    for (const schemaKey of sortedSchemaKeys) {
      const { name, schema } = uniqueSchemasBy$id.get(schemaKey);
      const schemaCoId = schemaCoIdMap.get(schemaKey);
      
      if (!schemaCoId) {
        throw new Error(`No co-id found for schema ${name} with $id ${schemaKey}`);
      }
      
      transformedSchemas[name] = transformSchemaForSeeding(schema, schemaCoIdMap);
      // Update $id to use co-id
      transformedSchemas[name].$id = schemaCoId;
      transformedSchemasByKey.set(schemaKey, transformedSchemas[name]);
    }
    
    // Phase 2.5: Validate transformed schemas against their $schema meta-schema
    // Validate in dependency order so referenced schemas are already registered
    const { ValidationEngine } = await import('@MaiaOS/schemata/validation.engine.js');
    const validationEngine = new ValidationEngine();
    
    // Set up schema resolver for loading meta-schemas and referenced schemas
    // Check in-memory transformed schemas map first (since we're seeding), then fallback to DB
    validationEngine.setSchemaResolver(async (schemaKey) => {
      // First check if it's in the transformed schemas map (being seeded)
      if (schemaKey.startsWith('co_z')) {
        // Find schema by co-id in transformedSchemas
        for (const schema of Object.values(transformedSchemas)) {
          if (schema.$id === schemaKey) {
            return schema;
          }
        }
      } else if (schemaKey.startsWith('@schema/')) {
        // Human-readable ID - check transformedSchemasByKey
        const transformed = transformedSchemasByKey.get(schemaKey);
        if (transformed) {
          return transformed;
        }
      }
      // Fallback: try to load from DB (if already stored)
      return await this.getSchema(schemaKey);
    });
    
    await validationEngine.initialize();
    
    // Validate each transformed schema in dependency order
    for (const schemaKey of sortedSchemaKeys) {
      const { name } = uniqueSchemasBy$id.get(schemaKey);
      const schema = transformedSchemas[name];
      
      const result = await validationEngine.validateSchemaAgainstMeta(schema);
      if (!result.valid) {
        const errorDetails = result.errors
          .map(err => `  - ${err.instancePath}: ${err.message}`)
          .join('\n');
        throw new Error(`Transformed schema '${name}' failed validation:\n${errorDetails}`);
      }
    }
    
    // Phase 3: Seed schemas to IndexedDB with co-ids in dependency order
    await this._seedSchemas(transformedSchemas, schemaCoIdMap, sortedSchemaKeys, uniqueSchemasBy$id);
    
    // Phase 3.5: Register data collection co-ids BEFORE transforming instances
    // This ensures query objects can be transformed to use co-ids during Phase 4
    // Store the co-ids so _seedData can reuse them (avoid duplicate registration)
    const dataCollectionCoIds = new Map(); // Map: collectionName → co-id
    if (data) {
      for (const [collectionName, collection] of Object.entries(data)) {
        const schemaKey = `@schema/${collectionName}`;
        
        // Check if @schema/collectionName is already registered (e.g., as a schema definition)
        // If so, reuse that co-id instead of generating a new one
        // This handles the case where a schema exists with the same name as the data collection
        let collectionCoId;
        const existingCoId = coIdRegistry.registry.get(schemaKey);
        if (existingCoId) {
          collectionCoId = existingCoId;
          // Still register collectionName → co-id mapping for data collection lookups
          coIdRegistry.register(collectionName, collectionCoId);
        } else {
          // Generate co-id for collection (same algorithm as _seedData)
          collectionCoId = generateCoId({ collection: collectionName });
          
          // Register both @schema/collectionName and collectionName → collectionCoId
          // This allows transformInstanceForSeeding to resolve query objects
          coIdRegistry.register(schemaKey, collectionCoId);
          coIdRegistry.register(collectionName, collectionCoId);
        }
        
        // Store for reuse in _seedData
        dataCollectionCoIds.set(collectionName, collectionCoId);
      }
    }
    
    // Phase 4: Generate co-ids and transform all configs/instances
    // Strategy: Generate co-ids for all unique $id values first, then assign to all instances
    // This ensures instances with the same $id (e.g., list-item/list-item in actors, views, contexts)
    // get the same co-id, preventing duplicate registration errors
    
    // Step 1: Collect all instances (deduplicated by $id)
    const instanceCoIdMap = new Map(); // Maps instance key → co-id
    const instanceByIdMap = new Map(); // Maps $id → { key, instance } (for deduplication)
    const processedInstanceIds = new Set(); // Track which $id values we've processed
    
    const collectInstances = (configObj, prefix = '') => {
      const instances = [];
      for (const [key, value] of Object.entries(configObj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (value.$schema || value.$id || (prefix === '' && key === 'vibe')) {
            // This is an instance (including vibe at root level)
            const instanceKey = prefix ? `${prefix}.${key}` : key;
            const instanceId = value.$id || instanceKey;
            
            // Deduplicate by $id - if we've seen this $id before, reuse the same instance
            if (!instanceByIdMap.has(instanceId)) {
              instanceByIdMap.set(instanceId, { key: instanceKey, instance: value });
              instances.push({ key: instanceKey, instance: value, instanceId });
            } else {
              // Same $id, different key - we'll reuse the co-id from the first occurrence
              const existing = instanceByIdMap.get(instanceId);
              instances.push({ key: instanceKey, instance: value, instanceId, reuseCoId: existing.key });
            }
          } else {
            // Recurse into nested objects
            instances.push(...collectInstances(value, prefix ? `${prefix}.${key}` : key));
          }
        } else if (Array.isArray(value)) {
          // Handle arrays of instances (e.g., styles: {...}, actors: {...})
          value.forEach((item, index) => {
            if (item && typeof item === 'object' && (item.$schema || item.$id)) {
              const instanceKey = prefix ? `${prefix}.${key}[${index}]` : `${key}[${index}]`;
              const instanceId = item.$id || instanceKey;
              
              // Deduplicate by $id
              if (!instanceByIdMap.has(instanceId)) {
                instanceByIdMap.set(instanceId, { key: instanceKey, instance: item });
                instances.push({ key: instanceKey, instance: item, instanceId });
              } else {
                const existing = instanceByIdMap.get(instanceId);
                instances.push({ key: instanceKey, instance: item, instanceId, reuseCoId: existing.key });
              }
            }
          });
        }
      }
      return instances;
    };
    
    const allInstances = collectInstances(configs);
    
    // Step 2: Generate co-ids for all unique $id values first
    const uniqueInstanceIds = new Set();
    for (const { instanceId } of allInstances) {
      if (instanceId && !uniqueInstanceIds.has(instanceId)) {
        uniqueInstanceIds.add(instanceId);
      }
    }
    
    // Generate co-ids for all unique $id values
    const coIdByInstanceId = new Map();
    for (const instanceId of uniqueInstanceIds) {
      // Get the first instance with this $id (stored in instanceByIdMap)
      const firstOccurrence = instanceByIdMap.get(instanceId);
      if (firstOccurrence) {
        const instanceCoId = generateCoId(firstOccurrence.instance);
        coIdByInstanceId.set(instanceId, instanceCoId);
        // Register in registry immediately
        coIdRegistry.register(instanceId, instanceCoId);
        processedInstanceIds.add(instanceId);
      }
    }
    
    // Step 3: Assign co-ids to all instances (reusing for duplicates)
    for (const { key, instance, instanceId, reuseCoId } of allInstances) {
      // Get co-id for this $id (either generated or reused)
      const instanceCoId = coIdByInstanceId.get(instanceId);
      if (!instanceCoId) {
        throw new Error(`[IndexedDBBackend] No co-id found for instance ${key} with $id: ${instanceId}`);
      }
      
      // Store mappings
      instanceCoIdMap.set(key, instanceCoId);
      instanceCoIdMap.set(instanceId, instanceCoId); // Map by $id too
      
      // Special handling for tools: also register by `name` field (e.g., @core/noop, @db)
      // Tools use `name` as their runtime identifier, not $id
      if (instance.name && instance.name.startsWith('@')) {
        instanceCoIdMap.set(instance.name, instanceCoId);
        coIdRegistry.register(instance.name, instanceCoId);
      }
      
      // SET $id to co-id immediately (before transformation) - modifies original object
      instance.$id = instanceCoId;
      
      // Register key → co-id mapping in registry (for transformation)
      coIdRegistry.register(key, instanceCoId);
      // Also register instanceId → co-id mapping (for subscriptions, children, etc.)
      // Always register instanceId separately to ensure lookups work (even if same as key)
      coIdRegistry.register(instanceId, instanceCoId);
      
      
      // Error logging for duplicates (instead of silently reusing)
      if (reuseCoId) {
        console.error(`[IndexedDBBackend] ❌ DUPLICATE $id DETECTED: "${instanceId}" is used in multiple files (key: ${key}, original: ${reuseCoId}). Each .maia file must have a unique $id. Please update the files to use unique IDs (e.g., @actor/vibe, @context/vibe).`);
      }
      
    }
    
    // Step 3a: Extract subscriptions, inbox, tokens, and components as separate CoValues
    // NOTE: subscriptions and inboxes are now in separate .maia files (e.g., vibe.subscriptions.maia, vibe.inbox.maia)
    // No extraction logic needed - they're already clean and separated at the definition level
    
    // NOTE: All CoValues (subscriptions, inboxes, tokens, components) are now properly defined
    // in their own .maia files at the definition level. No runtime extraction hacks needed!
    
    
    // Note: tokens and components are now embedded objects in styles (no extraction needed)
    
    // Step 3b: Transform all instances (now $id is already set to co-id, transform references)
    // Note: Extraction already modified configs in-place (replaced arrays with co-ids)
    const transformedConfigs = {};
    for (const [configType, configValue] of Object.entries(configs)) {
      if (Array.isArray(configValue)) {
        transformedConfigs[configType] = configValue.map(item => 
          transformInstanceForSeeding(item, coIdRegistry.getAll())
        );
      } else if (configValue && typeof configValue === 'object') {
        // Handle nested objects (actors, views, contexts, etc.)
        // These are objects with nested instances: { 'vibe/vibe': {...}, 'list/list': {...} }
        if (configType === 'vibe') {
          // Vibe is a single instance at root level
          transformedConfigs[configType] = transformInstanceForSeeding(configValue, coIdRegistry.getAll());
        } else {
          // Nested objects: transform each nested instance individually
          transformedConfigs[configType] = {};
          for (const [instanceKey, instance] of Object.entries(configValue)) {
            transformedConfigs[configType][instanceKey] = transformInstanceForSeeding(instance, coIdRegistry.getAll());
          }
        }
      } else {
        transformedConfigs[configType] = configValue;
      }
    }
    
    // Note: subscriptions, inboxes, tokens, and components are all handled at the .maia definition level
    // They're seeded as regular config types (subscriptions, inboxes) via seedConfigType
    
    // Step 4: Store human-readable → co-id mappings in IndexedDB registry
    // Note: We'll store all mappings after seeding configs (need instanceCoIdMap)
    // This is called later after _seedConfigs
    
    // Phase 4.5: Validate transformed instances against their $schema schemas
    const { validateAgainstSchemaOrThrow } = await import('@MaiaOS/schemata/validation.helper.js');
    const { setSchemaResolver } = await import('@MaiaOS/schemata/validation.helper.js');
    
    // Set up schema resolver for dynamic schema loading
    // The ValidationEngine will dynamically resolve and register schemas as needed via _resolveAndRegisterSchemaDependencies
    // This is more efficient than pre-registering all schemas, and ensures correct dependency resolution
    setSchemaResolver(async (schemaKey) => {
      // First check transformed schemas (in-memory, being seeded)
      if (schemaKey.startsWith('co_z')) {
        for (const schema of Object.values(transformedSchemas)) {
          if (schema.$id === schemaKey) {
            return schema;
          }
        }
      } else if (schemaKey.startsWith('@schema/')) {
        const entry = uniqueSchemasBy$id.get(schemaKey);
        if (entry) {
          const transformed = transformedSchemas[entry.name];
          if (transformed) {
            return transformed;
          }
        }
      }
      
      // Fallback to DB (schemas were just seeded in Phase 3)
      return await this.getSchema(schemaKey);
    });
    
    // Validate each transformed instance
    for (const [configType, configValue] of Object.entries(transformedConfigs)) {
      if (Array.isArray(configValue)) {
        for (const [index, instance] of configValue.entries()) {
          if (instance && instance.$schema) {
            const schema = await this.getSchema(instance.$schema);
            if (schema) {
              await validateAgainstSchemaOrThrow(
                schema,
                instance,
                `${configType}[${index}] (${instance.$id || 'no-id'})`
              );
            }
          }
        }
      } else if (configValue && typeof configValue === 'object' && configValue.$schema) {
        const schema = await this.getSchema(configValue.$schema);
        if (schema) {
          await validateAgainstSchemaOrThrow(
            schema,
            configValue,
            `${configType} (${configValue.$id || 'no-id'})`
          );
        }
      } else if (configValue && typeof configValue === 'object') {
        // Nested objects (e.g., actors: { 'vibe/vibe': {...} })
        for (const [instanceKey, instance] of Object.entries(configValue)) {
          if (instance && instance.$schema) {
            const schema = await this.getSchema(instance.$schema);
            if (schema) {
              await validateAgainstSchemaOrThrow(
                schema,
                instance,
                `${configType}.${instanceKey} (${instance.$id || 'no-id'})`
              );
            }
          }
        }
      }
    }
    
    // Phase 5: Validate all configs/instances - REJECT if nested co-types found
    // Note: Instances are now validated during seeding (Phase 4.5) and at runtime
    // We only validate schemas for nested co-types here
    
    // Phase 6: Seed configs/instances to IndexedDB with co-ids
    await this._seedConfigs(transformedConfigs, instanceCoIdMap, generateCoId);
    
    // Phase 7: Generate co-ids for all data entities (todo items, etc.) - under the hood
    // Data entities get co-ids generated automatically during creation
    // For seeding, we'll generate them here
    
    // Phase 8: Seed data entities to IndexedDB with co-ids (no hardcoded `id` field)
    // Simple seeding: always seed data (data store already flushed above)
    try {
      // Pass dataCollectionCoIds map to reuse co-ids from Phase 3.5 (avoid duplicate registration)
      await this._seedData(data, generateCoId, coIdRegistry, dataCollectionCoIds);
    } catch (error) {
      console.error('[IndexedDBBackend] Error seeding data:', error);
      throw error;
    }
    
    // Phase 8b: Store ALL human-readable → co-id mappings in coIdRegistry store
    // Pass original configs to build @schema/type:path mappings correctly
    // Must be called AFTER _seedData or _registerExistingDataCollections so data collection mappings are included
    // Always run this phase even if previous phases had errors (to populate registry)
    try {
      await this._storeCoIdRegistry(coIdRegistry, schemaCoIdMap, instanceCoIdMap, configs);
    } catch (error) {
      console.error('[IndexedDBBackend] Error storing co-id registry:', error);
      throw error;
    }
  }
  
  /**
   * Load existing co-id registry from database
   * Preserves mappings for data collections and other persisted entities
   * @private
   * @param {CoIdRegistry} coIdRegistry - Registry to populate
   */
  async _loadCoIdRegistry(coIdRegistry) {
    try {
      if (!this.db.objectStoreNames.contains('coIdRegistry')) {
        console.log('[IndexedDBBackend] coIdRegistry store does not exist, starting fresh');
        return;
      }
      
      const transaction = this.db.transaction(['coIdRegistry'], 'readonly');
      const store = transaction.objectStore('coIdRegistry');
      const request = store.getAll();
      const existingMappings = await this._promisifyRequest(request);
      
      if (existingMappings && existingMappings.length > 0) {
        let count = 0;
        for (const item of existingMappings) {
          if (item.key && item.value) {
            coIdRegistry.register(item.key, item.value);
            count++;
          }
        }
        console.log(`[IndexedDBBackend] Loaded ${count} existing co-id mappings from registry`);
      }
    } catch (error) {
      console.warn('[IndexedDBBackend] Error loading co-id registry, starting fresh:', error);
      // Don't throw - allow seeding to continue with fresh registry
    }
  }

  /**
   * Normalize schema for comparison (remove $id, sort keys)
   * @private
   * @param {Object} schema - Schema to normalize
   * @returns {string} Normalized JSON string
   */
  _normalizeSchemaForComparison(schema) {
    const normalized = { ...schema };
    delete normalized.$id; // Remove $id for comparison
    return JSON.stringify(normalized, Object.keys(normalized).sort());
  }

  /**
   * Check if schemas have changed (need reseeding)
   * Compares incoming schemas with existing schemas by content
   * @private
   * @param {Object} newSchemas - New schemas to compare
   * @returns {Promise<boolean>} true if schemas changed (should reseed)
   */
  async _shouldReseedSchemas(newSchemas) {
    try {
      // Get existing schemas from database
      const transaction = this.db.transaction(['schemas'], 'readonly');
      const store = transaction.objectStore('schemas');
      const request = store.getAll();
      const existingSchemas = await this._promisifyRequest(request);
      
      // If no existing schemas, need to seed
      if (!existingSchemas || existingSchemas.length === 0) {
        return true;
      }
      
      // Build map of existing schemas by $id (co-id)
      const existingByCoId = new Map();
      for (const item of existingSchemas) {
        if (item.value && item.value.$id) {
          existingByCoId.set(item.value.$id, item.value);
        }
      }
      
      // Generate co-ids for new schemas and compare
      const { generateCoId } = await import('@MaiaOS/schemata/co-id-generator');
      
      // Deduplicate new schemas by $id
      const uniqueNewSchemasBy$id = new Map();
      for (const [name, schema] of Object.entries(newSchemas)) {
        const schemaKey = schema.$id || `@schema/${name}`;
        if (!uniqueNewSchemasBy$id.has(schemaKey)) {
          uniqueNewSchemasBy$id.set(schemaKey, schema);
        }
      }
      
      // Compare count first (quick check)
      if (uniqueNewSchemasBy$id.size !== existingByCoId.size) {
        console.log(`[IndexedDBBackend] Schema count changed: ${existingByCoId.size} → ${uniqueNewSchemasBy$id.size}`);
        return true;
      }
      
      // Compare each schema by content (deep equality)
      for (const [schemaKey, newSchema] of uniqueNewSchemasBy$id) {
        const newCoId = generateCoId(newSchema);
        const existingSchema = existingByCoId.get(newCoId);
        
        if (!existingSchema) {
          // New schema not found in existing
          console.log(`[IndexedDBBackend] New schema detected: ${schemaKey}`);
          return true;
        }
        
        // Compare schema content (deep equality via normalized JSON)
        if (this._normalizeSchemaForComparison(newSchema) !== this._normalizeSchemaForComparison(existingSchema)) {
          console.log(`[IndexedDBBackend] Schema content changed: ${schemaKey}`);
          return true;
        }
      }
      
      // All schemas are identical
      return false;
    } catch (error) {
      // On error, default to reseeding (safe fallback for schema comparison errors)
      console.warn('[IndexedDBBackend] Error comparing schemas, will reseed to ensure consistency:', error.message);
      return true;
    }
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
    const transaction = this.db.transaction(storeNames, 'readwrite');
    
    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName);
      await this._promisifyRequest(store.clear());
    }
  }
  
  /**
   * Seed configs into database with co-ids
   * @private
   * @param {Object} configs - Transformed configs with co-ids
   * @param {Map<string, string>} instanceCoIdMap - Map of instance key → co-id
   * @param {Function} generateCoId - Function to generate co-id for instances
   */
  async _seedConfigs(configs, instanceCoIdMap, generateCoId) {
    const transaction = this.db.transaction(['configs'], 'readwrite');
    const store = transaction.objectStore('configs');
    
    let count = 0;
    
    // Seed vibe (use co-id as PRIMARY KEY - required!)
    if (configs.vibe) {
      // The vibe's $id should already be set to a co-id in Phase 4
      // But if it's not (e.g., still human-readable), try to get it from the map
      let vibeCoId = configs.vibe.$id;
      
      // If $id is not a co-id, look it up in the instance map
      if (!vibeCoId || !vibeCoId.startsWith('co_z')) {
        // Try to get co-id from map using the human-readable ID
        const humanReadableId = vibeCoId || 'vibe';
        vibeCoId = instanceCoIdMap.get('vibe') || instanceCoIdMap.get(humanReadableId);
        
        // If still not found, generate one (shouldn't happen if Phase 4 worked correctly)
        if (!vibeCoId || !vibeCoId.startsWith('co_z')) {
          vibeCoId = generateCoId(configs.vibe);
        }
        
        // Set $id to co-id (required!)
        configs.vibe.$id = vibeCoId;
      }
      
      // Final validation
      if (!vibeCoId || !vibeCoId.startsWith('co_z')) {
        throw new Error(`Vibe missing valid co-id. Expected co-id starting with 'co_z', got: ${vibeCoId}`);
      }
      
      // Extract vibe identifiers for mapping
      const vibeName = configs.vibe.name || 'default';
      
      // Find original $id - check instanceCoIdMap for the vibe's original $id
      // The vibe's original $id was "todos" (from todos.vibe.maia file)
      // We registered it in Phase 4, so it should be in instanceCoIdMap
      let originalVibeId = null;
      
      // Check if 'todos' maps to this co-id (the original $id from the .maia file)
      if (instanceCoIdMap.get('todos') === vibeCoId) {
        originalVibeId = 'todos';
      } else {
        // Fallback: search for any human-readable ID that maps to this co-id
        // (excluding the root 'vibe' key and nested keys with dots)
        for (const [humanId, mappedCoId] of instanceCoIdMap.entries()) {
          if (mappedCoId === vibeCoId && humanId !== 'vibe' && !humanId.includes('.')) {
            originalVibeId = humanId;
            break;
          }
        }
      }
      
      // Store with co-id as PRIMARY KEY (required!)
      // NO human-readable keys in content stores - mappings go to coIdRegistry only
      console.log(`[IndexedDBBackend] Storing vibe with co-id: ${vibeCoId}, originalId: ${originalVibeId || 'unknown'}, $id: ${configs.vibe.$id}`);
      
      await this._promisifyRequest(store.put({
        key: vibeCoId,
        value: configs.vibe
      }));
      
      count++;
      }
    
    // Helper function to seed a config type
    const seedConfigType = async (configType, configsOfType, generateCoId) => {
      if (!configsOfType) return 0;
      
      let typeCount = 0;
      for (const [path, config] of Object.entries(configsOfType)) {
        // CRITICAL: Config MUST have a co-id already set from transformation phase
        // NEVER generate a new co-id here - that would create mismatches!
        // The co-id should have been set in Step 3 (Phase 4) before transformation
        let coId = config.$id;
        
        // If $id is missing, try to find it in instanceCoIdMap (should have been set in Phase 4)
        if (!coId || !coId.startsWith('co_z')) {
          // Try lookup by path
          coId = instanceCoIdMap.get(`${configType}.${path}`);
          
          // If still not found, try lookup by original $id (before transformation)
          // The instanceCoIdMap stores both "path" → co-id and "original $id" → co-id
          if (!coId || !coId.startsWith('co_z')) {
            // Try to find by reverse lookup - find what key maps to this config
            // This should never happen if seeding worked correctly
            const possibleKeys = [
              path, // e.g., "@actor/agent"
              `${configType}.${path}`, // e.g., "actors.@actor/agent"
            ];
            
            for (const key of possibleKeys) {
              if (instanceCoIdMap.has(key)) {
                coId = instanceCoIdMap.get(key);
                break;
              }
            }
          }
          
          // If STILL not found, this is a critical error - don't generate a new one!
          if (!coId || !coId.startsWith('co_z')) {
            throw new Error(
              `[IndexedDBBackend] CRITICAL: Config ${configType}:${path} has no co-id! ` +
              `This means the transformation phase failed. ` +
              `Config $id: ${config.$id}, ` +
              `Available keys in instanceCoIdMap: ${Array.from(instanceCoIdMap.keys()).filter(k => k.includes(configType) || k.includes(path)).join(', ')}`
            );
          }
          
          // Set $id to the found co-id
          config.$id = coId;
        }
        
        // Validate co-id format
        if (!coId.startsWith('co_z')) {
          throw new Error(`Config ${configType}:${path} has invalid co-id format. Expected co-id starting with 'co_z', got: ${coId}`);
        }
        
        // CRITICAL: Verify we're not overwriting a different config with the same co-id
        // Check if this co-id already exists with different content
        const existingConfig = await this._promisifyRequest(store.get(coId));
        if (existingConfig?.value) {
          // Compare content to ensure it's the same config
          const existingContent = JSON.stringify(existingConfig.value, Object.keys(existingConfig.value).sort());
          const newContent = JSON.stringify(config, Object.keys(config).sort());
          if (existingContent !== newContent) {
            throw new Error(
              `[IndexedDBBackend] CRITICAL BUG: Co-id ${coId} already exists with DIFFERENT content! ` +
              `This would overwrite existing config. ` +
              `Existing: ${existingConfig.value.$id || 'no $id'}, ` +
              `New: ${config.$id || 'no $id'}. ` +
              `This indicates a bug in co-id generation or reuse logic.`
            );
          }
          // Same content, safe to skip (idempotent)
          continue;
        }
        
        // Store with co-id as PRIMARY KEY (required!)
        // NO human-readable keys in content stores - mappings go to coIdRegistry only
        await this._promisifyRequest(store.put({
          key: coId,
          value: config
        }));
        
        
        typeCount++;
      }
      return typeCount;
    };
    
    // Seed styles
    count += await seedConfigType('style', configs.styles, generateCoId);
    
    // Seed actors
    count += await seedConfigType('actor', configs.actors, generateCoId);
    
    // Seed views
    count += await seedConfigType('view', configs.views, generateCoId);
    
    // Seed contexts
    count += await seedConfigType('context', configs.contexts, generateCoId);
    
    // Seed states
    count += await seedConfigType('state', configs.states, generateCoId);
    
    // Seed interfaces
    count += await seedConfigType('interface', configs.interfaces, generateCoId);
    
    // Seed subscriptions (colist CoValues)
    count += await seedConfigType('subscriptions', configs.subscriptions, generateCoId);
    
    // Seed inboxes (costream CoValues)
    count += await seedConfigType('inbox', configs.inboxes, generateCoId);
    
    // Note: subscriptions/inboxes/tokens/components all handled cleanly at the .maia definition level
    
    // Seed tool definitions
    count += await seedConfigType('tool', configs.tool, generateCoId);
  }
  
  /**
   * Seed schemas into database with co-ids in dependency order
   * @private
   * @param {Object} schemas - Transformed schemas with co-ids (keyed by name)
   * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
   * @param {Array<string>} sortedSchemaKeys - Schema keys sorted by dependency order
   * @param {Map<string, {name: string, schema: Object}>} uniqueSchemasBy$id - Map of schemaKey -> {name, schema}
   */
  async _seedSchemas(schemas, coIdMap, sortedSchemaKeys, uniqueSchemasBy$id) {
    const transaction = this.db.transaction(['schemas'], 'readwrite');
    const store = transaction.objectStore('schemas');
    
    let count = 0;
    
    // Seed schemas in dependency order (leaf schemas first, then composite schemas)
    for (const schemaKey of sortedSchemaKeys) {
      const { name } = uniqueSchemasBy$id.get(schemaKey);
      const schema = schemas[name];
      
      if (!schema) {
        console.warn(`[IndexedDBBackend] Schema ${name} not found in transformedSchemas, skipping`);
        continue;
      }
      
      // Schema $id should already be a co-id (set in Phase 2)
      const coId = schema.$id;
      
      if (!coId || !coId.startsWith('co_z')) {
        throw new Error(`Schema ${name} missing co-id in $id. Expected co-id, got: ${coId}`);
      }
      
      // Store schema with co-id as PRIMARY KEY (required!)
      // NO human-readable keys in content stores - mappings go to coIdRegistry only
      await this._promisifyRequest(store.put({
        key: coId,
        value: schema
      }));
      
      count++;
    }
  }
  
  /**
   * Seed initial data into database with co-ids
   * @private
   * @param {Object} data - Initial data collections
   * @param {Function} generateCoId - Function to generate co-id for data entity
   * @param {CoIdRegistry} coIdRegistry - Registry to store mappings
   * @param {Map<string, string>} [dataCollectionCoIds] - Pre-registered collection co-ids from Phase 3.5 (to avoid duplicate registration)
   */
  async _seedData(data, generateCoId, coIdRegistry, dataCollectionCoIds = null) {
    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    
    let totalItems = 0;
    
    for (const [collectionName, collection] of Object.entries(data)) {
      // Get schema co-id for this collection (from Phase 3.5 or generate)
      let schemaCoId;
      const schemaKey = `@schema/${collectionName}`;
      if (dataCollectionCoIds && dataCollectionCoIds.has(collectionName)) {
        schemaCoId = dataCollectionCoIds.get(collectionName);
      } else if (coIdRegistry.registry.has(schemaKey)) {
        schemaCoId = coIdRegistry.registry.get(schemaKey);
      } else {
        console.warn(`[IndexedDBBackend] Warning: No schema co-id found for ${collectionName}, skipping seed`);
        continue;
      }
      
      // Store each item individually with $schema field
      if (Array.isArray(collection)) {
        for (const item of collection) {
          const coId = item.$id || generateCoId(item);
          const record = {
            $id: coId,
            $schema: schemaCoId,  // Store schema co-id in item
            ...item
          };
          
          await this._promisifyRequest(store.put({
            key: coId,
            value: record
          }));
          
          totalItems++;
        }
      }
    }
  }
  
  /**
   * Resolve human-readable key to co-id via coIdRegistry
   * Used for config lookups and data collection schema resolution
   * @param {string} humanReadableKey - Human-readable key (e.g., 'todos', '@schema/todos', 'vibe/vibe')
   * @returns {Promise<string|null>} Co-id or null if not found
   */
  async resolveHumanReadableKey(humanReadableKey) {
    // If already a co-id, return directly
    if (humanReadableKey && humanReadableKey.startsWith('co_z')) {
      return humanReadableKey;
    }
    
    // Look up in coIdRegistry store
    try {
      if (!this.db.objectStoreNames.contains('coIdRegistry')) {
        console.warn('[IndexedDBBackend] coIdRegistry store does not exist');
        return null;
      }
      
      const transaction = this.db.transaction(['coIdRegistry'], 'readonly');
      const store = transaction.objectStore('coIdRegistry');
      const request = store.get(humanReadableKey);
      const result = await this._promisifyRequest(request);
      
      return result?.value || null;
    } catch (error) {
      console.warn(`[IndexedDBBackend] Failed to resolve human-readable key ${humanReadableKey}:`, error);
      return null;
    }
  }
  
  /**
   * Get multiple configs in a single transaction (batch operation)
   * Optimizes performance by reducing transaction overhead
   * @param {string} schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string[]} keys - Array of config co-ids to fetch
   * @returns {Promise<Map<string, any>>} Map of coId -> config value
   */
  async getBatch(schema, keys) {
    // Validate schema is a co-id (runtime code must use co-ids only)
    if (!schema || !schema.startsWith('co_z')) {
      throw new Error(`[IndexedDBBackend] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    if (!keys || keys.length === 0) {
      return new Map();
    }
    
    // Filter to only co-id keys (skip human-readable keys for batch)
    const coIdKeys = keys.filter(key => key && key.startsWith('co_z'));
    
    if (coIdKeys.length === 0) {
      return new Map();
    }
    
    // Single transaction to get all configs
    const configsTransaction = this.db.transaction(['configs'], 'readonly');
    const configsStore = configsTransaction.objectStore('configs');
    
    // Get all keys in parallel within the same transaction
    const promises = coIdKeys.map(key => 
      this._promisifyRequest(configsStore.get(key))
    );
    
    const results = await Promise.all(promises);
    
    // Build map: coId -> config value
    const map = new Map();
    coIdKeys.forEach((key, i) => {
      const result = results[i];
      if (result?.value) {
        map.set(key, result.value);
      } else if (result) {
        // If result exists but doesn't have .value, use the whole thing
        map.set(key, result);
      }
    });
    
    // If any configs weren't found in configs store, try data store
    const missingKeys = coIdKeys.filter(key => !map.has(key));
    if (missingKeys.length > 0) {
      const dataTransaction = this.db.transaction(['data'], 'readonly');
      const dataStore = dataTransaction.objectStore('data');
      
      const dataPromises = missingKeys.map(key => 
        this._promisifyRequest(dataStore.get(key))
      );
      
      const dataResults = await Promise.all(dataPromises);
      
      missingKeys.forEach((key, i) => {
        const result = dataResults[i];
        if (result?.value) {
          map.set(key, result.value);
        }
      });
    }
    
    return map;
  }
  
  /**
   * Create new record
   * @param {string} schema - Schema co-id (co_z...) for data collections
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} Created record with generated co-id
   */
  async create(schema, data) {
    const storeName = 'data'; // Only data store supports create
    
    // Import co-id generator
    const { generateCoId } = await import('@MaiaOS/schemata/co-id-generator');
    
    // Generate co-id for the item
    const coId = generateCoId(data);
    
    // Schema should already be a co-id (transformed during seeding)
    // Work directly with co-id, no registry lookup needed
    if (!schema.startsWith('co_z')) {
      throw new Error(`[IndexedDBBackend] Data collection schema must be a co-id, got: ${schema}. Query objects should be transformed during seeding.`);
    }
    
    // Create record with $id, $schema, and data fields
    const record = { 
      $id: coId, 
      $schema: schema,  // Store schema co-id in item for query filtering
      ...data 
    };
    
    // Store item directly with its co-id as the key
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    await this._promisifyRequest(store.put({
      key: coId,
      value: record
    }));
    
    // CRITICAL: Wait for transaction to commit before notifying observers
    await transaction.complete; // transaction.complete is already a Promise
    
    // Notify observers by re-reading the collection (ensures we have latest data)
    // Use direct database access for fresh data
    const dataTransaction = this.db.transaction(['data'], 'readonly');
    const dataStore = dataTransaction.objectStore('data');
    const allRequest = dataStore.getAll();
    const allResults = await this._promisifyRequest(allRequest);
    
    // Filter items by $schema field matching the schema co-id
    const updatedItems = (allResults || [])
      .map(item => item.value)
      .filter(item => item && item.$schema === schema)
      .map(item => ({
        ...item,
        id: item.$id
      }));
    
    this.notifyWithData(schema, updatedItems || []);
    
    return record;
  }
  
  /**
   * Update existing record
   * @param {string} schema - Schema co-id (co_z...) for data collections
   * @param {string} id - Record co-id ($id)
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  async update(schema, id, data) {
    const storeName = 'data';
    
    // Schema should already be a co-id (transformed during seeding)
    // Work directly with co-id, no registry lookup needed
    if (!schema.startsWith('co_z')) {
      throw new Error(`[IndexedDBBackend] Data collection schema must be a co-id, got: ${schema}. Query objects should be transformed during seeding.`);
    }
    
    // Get existing item directly by its co-id
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    const result = await this._promisifyRequest(request);
    
    if (!result || !result.value) {
      throw new Error(`[IndexedDBBackend] Record not found: ${id}`);
    }
    
    // Verify item belongs to this schema
    if (result.value.$schema !== schema) {
      throw new Error(`[IndexedDBBackend] Record ${id} does not belong to schema ${schema}`);
    }
    
    // Update record (preserve $id and $schema)
    const updatedRecord = { 
      ...result.value, 
      ...data,
      $id: result.value.$id,  // Preserve $id
      $schema: result.value.$schema  // Preserve $schema
    };
    
    // Save updated item
    await this._promisifyRequest(store.put({
      key: id,
      value: updatedRecord
    }));
    
    // CRITICAL: Wait for transaction to commit before notifying observers
    await transaction.complete; // transaction.complete is already a Promise
    
    // Notify observers by re-reading
    const dataStore = await this.read(schema, null, null);
    const updatedItems = dataStore.value;
    this.notifyWithData(schema, updatedItems);
    
    return updatedRecord;
  }
  
  /**
   * Update actor config (for system properties like watermark)
   * @param {string} schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} id - Actor co-id ($id)
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated config
   */
  async updateConfig(schema, id, data) {
    // Validate schema is a co-id (runtime code must use co-ids only)
    if (!schema || !schema.startsWith('co_z')) {
      throw new Error(`[IndexedDBBackend] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    const storeName = 'configs';
    
    // Get existing config directly by co-id
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    const result = await this._promisifyRequest(request);
    
    if (!result || !result.value) {
      throw new Error(`[IndexedDBBackend] Config not found: ${id}`);
    }
    
    // Update config (preserve $id and $schema)
    const updatedConfig = { 
      ...result.value, 
      ...data,
      $id: result.value.$id,  // Preserve $id
      $schema: result.value.$schema  // Preserve $schema
    };
    
    // Save updated config
    await this._promisifyRequest(store.put({
      key: id,
      value: updatedConfig
    }));
    
    // Wait for transaction to commit
    await transaction.complete;
    
    return updatedConfig;
  }

  /**
   * Delete record
   * @param {string} schema - Schema co-id (co_z...) for data collections
   * @param {string} id - Record co-id ($id)
   * @returns {Promise<boolean>} true if deleted
   */
  async delete(schema, id) {
    const storeName = 'data';
    
    // Schema should already be a co-id (transformed during seeding)
    // Work directly with co-id, no registry lookup needed
    if (!schema.startsWith('co_z')) {
      throw new Error(`[IndexedDBBackend] Data collection schema must be a co-id, got: ${schema}. Query objects should be transformed during seeding.`);
    }
    
    // Get existing item to verify it exists and belongs to this schema
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    const result = await this._promisifyRequest(request);
    
    if (!result || !result.value) {
      throw new Error(`[IndexedDBBackend] Record not found: ${id}`);
    }
    
    // Verify item belongs to this schema
    if (result.value.$schema !== schema) {
      throw new Error(`[IndexedDBBackend] Record ${id} does not belong to schema ${schema}`);
    }
    
    // Delete item directly
    await this._promisifyRequest(store.delete(id));
    
    // CRITICAL: Wait for transaction to commit before notifying observers
    await transaction.complete; // transaction.complete is already a Promise
    
    // Notify observers by re-reading
    const dataStore = await this.read(schema, null, null);
    const updatedItems = dataStore.value;
    this.notifyWithData(schema, updatedItems);
    
    return true;
  }
  
  
  /**
   * Read data - unified method that always returns reactive store
   * Replaces get(), query(), and subscribe() with single unified API
   * @param {string} schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} [key] - Optional: specific key (co-id) for single item
   * @param {Object} [filter] - Optional: filter criteria for collection queries
   * @returns {Promise<ReactiveStore>} Reactive store that holds current value and notifies on updates
   */
  async read(schema, key, filter) {
    // Import ReactiveStore
    const { ReactiveStore } = await import('../../../utils/reactive-store.js');
    
    // Validate schema is a co-id
    if (!schema || !schema.startsWith('co_z')) {
      throw new Error(`[IndexedDBBackend] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    // Create reactive store with null initial value
    const store = new ReactiveStore(null);
    
    // Get initial value immediately using direct database access
    let initialValue = null;
    if (key) {
      // Single-item lookup - check both configs and data stores
      if (key.startsWith('co_z')) {
        // Try configs store first (most common for single-item lookups)
        const configsTransaction = this.db.transaction(['configs'], 'readonly');
        const configsStore = configsTransaction.objectStore('configs');
        const configsRequest = configsStore.get(key);
        const configsResult = await this._promisifyRequest(configsRequest);
        
        if (configsResult?.value) {
          initialValue = configsResult.value;
        } else if (configsResult) {
          initialValue = configsResult;
        } else {
          // Fall back to data store if not found in configs
          const dataTransaction = this.db.transaction(['data'], 'readonly');
          const dataStore = dataTransaction.objectStore('data');
          const dataRequest = dataStore.get(key);
          const dataResult = await this._promisifyRequest(dataRequest);
          initialValue = dataResult?.value || null;
        }
      } else {
        // Human-readable key - resolve to co-id first, then lookup
        const storeName = this._getStoreName(schema);
        const possibleKeys = [`${schema}:${key}`, key];
        let coId = null;
        for (const possibleKey of possibleKeys) {
          coId = await this.resolveHumanReadableKey(possibleKey);
          if (coId) break;
        }
        
        if (coId) {
          const transaction = this.db.transaction([storeName], 'readonly');
          const dbStore = transaction.objectStore(storeName);
          const request = dbStore.get(coId);
          const result = await this._promisifyRequest(request);
          initialValue = result?.value || null;
        } else {
          initialValue = null;
        }
      }
    } else {
      // Collection lookup - direct database access
      const storeName = this._getStoreName(schema);
      const transaction = this.db.transaction([storeName], 'readonly');
      const dbStore = transaction.objectStore(storeName);
      const request = dbStore.getAll();
      const allResults = await this._promisifyRequest(request);
      
      if (storeName === 'configs' || storeName === 'schemas') {
        // Filter to only entries with co-id keys (actual configs/schemas, not mappings)
        const items = (allResults || [])
          .filter(item => item.key && item.key.startsWith('co_z'))
          .map(item => item.value);
        
        // Apply filter if provided
        if (filter && items.length > 0) {
          initialValue = this._applyFilter(items, filter);
        } else {
          initialValue = items;
        }
      } else {
        // Data items: Filter by $schema field matching the query schema co-id
        let items = (allResults || [])
          .map(item => item.value)
          .filter(item => item && item.$schema === schema);
        
        // Apply filter if provided
        if (filter && items.length > 0) {
          items = this._applyFilter(items, filter);
        }
        
        // Normalize items: add id field from $id for view compatibility
        initialValue = items.map(item => ({
          ...item,
          id: item.$id
        }));
      }
    }
    
    // Set initial value if found
    if (initialValue !== null && initialValue !== undefined) {
      if (key) {
        // Single item
        store._set(initialValue);
      } else {
        // Collection - normalize items: add id field from $id for view compatibility
        if (Array.isArray(initialValue)) {
          const normalized = initialValue.map(item => ({
            ...item,
            id: item.$id
          }));
          store._set(normalized);
        } else {
          store._set(initialValue);
        }
      }
    } else if (!key) {
      // Collection with no data - set empty array
      store._set([]);
    }
    
    // Register observer directly for reactive updates
    // This is the unified reactive pattern: read() returns store, store.subscribe() for updates
    if (!this.observers.has(schema)) {
      this.observers.set(schema, new Set());
    }
    
    const observer = {
      filter,
      callback: (data) => {
        // If key is provided, filter to that specific item
        if (key) {
          let item = null;
          if (Array.isArray(data)) {
            // Collection: find item by key
            item = data.find(item => item?.$id === key || item?.id === key) || null;
          } else if (data && (data.$id === key || data.id === key)) {
            // Single item that matches key
            item = data;
          } else {
            // Single item but doesn't match key
            item = null;
          }
          // Only update if we found the item (don't overwrite valid initial value with null)
          if (item !== null) {
            store._set(item);
          }
        } else {
          // No key: use data as-is (collection or single item)
          // Normalize items: add id field from $id for view compatibility
          if (Array.isArray(data)) {
            const normalized = data.map(item => ({
              ...item,
              id: item.$id
            }));
            store._set(normalized);
          } else {
            store._set(data);
          }
        }
      }
    };
    
    this.observers.get(schema).add(observer);
    
    // Return unsubscribe function
    const unsubscribe = () => {
      const observers = this.observers.get(schema);
      if (observers) {
        observers.delete(observer);
        if (observers.size === 0) {
          this.observers.delete(schema);
        }
      }
    };
    
    // Store unsubscribe function in store for cleanup
    store._unsubscribe = unsubscribe;
    
    return store;
  }
  
  
  /**
   * Notify all observers with provided data
   * @param {string} schema - Schema co-id (co_z...) for data collections
   * @param {any} data - Data to send to observers (collection or single item)
   */
  notifyWithData(schema, data) {
    const observers = this.observers.get(schema);
    if (!observers || observers.size === 0) {
      return; // No observers, silent return
    }
    
    observers.forEach((observer) => {
      // Apply filter if provided
      let filteredData = data;
      if (observer.filter && Array.isArray(data)) {
        filteredData = this._applyFilter(data, observer.filter);
      }
      
      // Normalize items: add id field from $id for view compatibility ($$id syntax)
      if (Array.isArray(filteredData)) {
        filteredData = filteredData.map(item => ({
          ...item,
          id: item.$id
        }));
      } else if (filteredData && filteredData.$id) {
        filteredData = {
          ...filteredData,
          id: filteredData.$id
        };
      }
      
      observer.callback(filteredData);
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
    const configTypes = ['actor', 'view', 'style', 'state', 'context', 'interface', 'vibe', 'tool', 'subscriptions', 'inbox'];
    
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
   * @param {string} schemaKey - Schema key (e.g., '@schema/actor', '@schema/data/todos') or co-id (e.g., 'co_z...')
   * @returns {Promise<Object|null>} Schema object or null if not found
   */
  async getSchema(schemaKey) {
    try {
      let schemaCoId = schemaKey;
      
      // If it's already a co-id, use it directly
      // Also check if it's incorrectly prefixed with @schema/ (bug fix)
      if (schemaKey.startsWith('@schema/co_z')) {
        // Extract the co-id from the incorrectly prefixed key
        schemaCoId = schemaKey.replace('@schema/', '');
      } else if (!schemaKey.startsWith('co_z')) {
        // Resolve human-readable key to co-id via registry
        schemaCoId = await this.resolveHumanReadableKey(schemaKey);
        if (!schemaCoId) {
          // Silent - too frequent and not user-facing
          return null;
        }
      }
      
      // Fetch schema using co-id
      const transaction = this.db.transaction(['schemas'], 'readonly');
      const store = transaction.objectStore('schemas');
      const request = store.get(schemaCoId);
      const result = await this._promisifyRequest(request);
      
      return result?.value || null;
    } catch (error) {
      console.warn(`[IndexedDBBackend] Error loading schema ${schemaKey}:`, error);
      return null;
    }
  }

  /**
   * Store co-id registry mappings in IndexedDB
   * Maps human-readable IDs to co-ids for lookups
   * @private
   * @param {CoIdRegistry} coIdRegistry - Registry with all mappings
   * @param {Map<string, string>} schemaCoIdMap - Map of schema name → co-id (for @schema/... mappings)
   * @param {Map<string, string>} instanceCoIdMap - Map of instance key → co-id (for @schema/type:path mappings)
   * @param {Object} configs - Original configs object (to extract config types and paths)
   */
  async _storeCoIdRegistry(coIdRegistry, schemaCoIdMap = null, instanceCoIdMap = null, configs = null) {
    try {
      // Check if coIdRegistry store exists
      if (!this.db.objectStoreNames.contains('coIdRegistry')) {
        console.warn('[IndexedDBBackend] coIdRegistry store does not exist, skipping registry storage. Database may need upgrade.');
        return;
      }
      
      const transaction = this.db.transaction(['coIdRegistry'], 'readwrite');
      const store = transaction.objectStore('coIdRegistry');
      
      const mappings = coIdRegistry.getAll();
      const storedKeys = new Set(Object.keys(mappings)); // Track what we've already stored
      let count = 0;
      
      // Store all mappings from CoIdRegistry (simple IDs like "todos", "vibe/vibe", "@schema/actor")
      for (const [humanReadableId, coId] of Object.entries(mappings)) {
        if (!storedKeys.has(humanReadableId)) {
          await this._promisifyRequest(store.put({
            key: humanReadableId,
            value: coId
          }));
          storedKeys.add(humanReadableId);
          count++;
        }
      }
      
      // Store @schema/... format mappings for schemas
      if (schemaCoIdMap) {
        for (const [schemaKey, coId] of schemaCoIdMap.entries()) {
          // schemaKey might be "@schema/actor" or just "actor"
          const fullSchemaKey = schemaKey.startsWith('@schema/') ? schemaKey : `@schema/${schemaKey}`;
          if (!storedKeys.has(fullSchemaKey)) {
            await this._promisifyRequest(store.put({
              key: fullSchemaKey,
              value: coId
            }));
            storedKeys.add(fullSchemaKey);
            count++;
          }
        }
      }
      
      // Store @schema/type:path format mappings for configs
      if (instanceCoIdMap && configs) {
        // Build mappings from configs structure
        const configTypes = {
          'actors': 'actor',
          'views': 'view',
          'contexts': 'context',
          'states': 'state',
          'interfaces': 'interface',
          'styles': 'style',
          'tool': 'tool'
        };
        
        for (const [configTypeKey, configType] of Object.entries(configTypes)) {
          const configsOfType = configs[configTypeKey];
          if (!configsOfType) continue;
          
          // Handle both objects and arrays
          const entries = Array.isArray(configsOfType) 
            ? configsOfType.map((item, idx) => [idx.toString(), item])
            : Object.entries(configsOfType);
          
          for (const [path, config] of entries) {
            // CRITICAL: Always use instanceCoIdMap as source of truth for co-id
            // This ensures we use the SAME co-id that was used when storing the config in _seedConfigs
            // instanceCoIdMap was built during Phase 4 and is what _seedConfigs uses
            let coId = null;
            
            // Try instanceCoIdMap lookup first (this is the source of truth)
            // Keys in instanceCoIdMap are like "actors.@actor/agent" or just "@actor/agent"
            const possibleKeys = [
              `${configTypeKey}.${path}`,  // e.g., "actors.@actor/agent"
              path,                         // e.g., "@actor/agent"
              config.$id || path           // Fallback to config.$id if path doesn't match
            ];
            
            for (const key of possibleKeys) {
              if (instanceCoIdMap && instanceCoIdMap.has(key)) {
                coId = instanceCoIdMap.get(key);
                break;
              }
            }
            
            // Fallback: if instanceCoIdMap lookup failed, try config.$id (might be co-id if config was transformed)
            if (!coId && config.$id && config.$id.startsWith('co_z')) {
              coId = config.$id;
            }
            
            // Fail fast if no co-id found
            if (!coId) {
              const availableKeys = instanceCoIdMap ? Array.from(instanceCoIdMap.keys()).filter(k => 
                k.includes(configType) || k.includes(path) || (config.$id && k.includes(config.$id))
              ).join(', ') : 'none';
              throw new Error(
                `[IndexedDBBackend] No co-id found for config ${configType}:${path} after transformation. ` +
                `config.$id: ${config.$id}, ` +
                `Available keys in instanceCoIdMap: ${availableKeys}`
              );
            }
            
            if (coId) {
              // Find original $id by reverse lookup in instanceCoIdMap (co-id → instanceId)
              // instanceCoIdMap stores both "path" → co-id and "original $id" → co-id mappings
              let originalId = null;
              
              // Special handling for tools: use the `name` field directly (e.g., @core/noop, @db)
              if (configType === 'tool' && config.name) {
                // Tools use `name` field as their identifier (e.g., "@core/noop", "@db")
                originalId = config.name;
              } else if (instanceCoIdMap) {
                // For other configs, reverse lookup in instanceCoIdMap
                // Find the key that maps to this co-id and matches @type/... pattern
                for (const [key, mappedCoId] of instanceCoIdMap.entries()) {
                  if (mappedCoId === coId && key.startsWith('@') && !key.startsWith('@schema/')) {
                    originalId = key;
                    break;
                  }
                }
              }
              
              // Fallback: if reverse lookup failed but path looks like a valid ID, use it
              if (!originalId && path && path.startsWith('@') && !path.startsWith('@schema/')) {
                originalId = path;
              }
              
              // ONLY register the original $id format (e.g., @actor/agent, @interface/agent, @core/noop)
              // No @schema/type:path format - just use the flat IDs directly!
              // Note: We use instanceCoIdMap as source of truth (same as _seedConfigs), so co-id should match
              if (originalId && !storedKeys.has(originalId)) {
                await this._promisifyRequest(store.put({
                  key: originalId,
                  value: coId
                }));
                storedKeys.add(originalId);
                count++;
              } else if (!originalId) {
                // For tools, this is expected if name is missing - skip silently
                // For other configs, this shouldn't happen
                if (configType !== 'tool') {
                  console.warn(`[IndexedDBBackend] Could not find original $id for ${configType}:${path} with co-id ${coId.substring(0, 20)}...`);
                }
              }
            } else {
              console.warn(`[IndexedDBBackend] Could not find co-id for config ${configType}:${path}`);
            }
          }
        }
        
        // Special handling for vibe
        if (configs.vibe && instanceCoIdMap) {
          // Get vibe co-id - try multiple possible keys
          const vibeCoId = instanceCoIdMap.get('vibe') || 
                          instanceCoIdMap.get('@vibe/todos') || 
                          instanceCoIdMap.get('todos');
          
          if (vibeCoId) {
            // Find original $id by reverse lookup in instanceCoIdMap
            // The vibe's $id is "@vibe/todos" (from manifest.vibe.maia)
            // It was registered in Phase 4, so it should be in instanceCoIdMap
            let vibeOriginalId = null;
            
            // First, try to find @vibe/todos directly (most common case)
            if (instanceCoIdMap.get('@vibe/todos') === vibeCoId) {
              vibeOriginalId = '@vibe/todos';
            } else {
              // Fallback: search for any human-readable ID that maps to this co-id
              // (excluding the root 'vibe' key and nested keys with dots)
              for (const [humanId, mappedCoId] of instanceCoIdMap.entries()) {
                if (mappedCoId === vibeCoId && humanId !== 'vibe' && !humanId.includes('.')) {
                  vibeOriginalId = humanId;
                  break;
                }
              }
            }
            
            // Fail fast if vibe original ID not found
            if (!vibeOriginalId) {
              const availableKeys = Array.from(instanceCoIdMap.keys()).filter(k => instanceCoIdMap.get(k) === vibeCoId);
              throw new Error(`[IndexedDBBackend] Could not find original vibe ID for co-id ${vibeCoId} in instanceCoIdMap. Available keys mapping to this co-id: ${availableKeys.join(', ')}`);
            }
            
            // Store @vibe/todos directly (the vibe's $id format) - this is what runtime code uses
            if (!storedKeys.has(vibeOriginalId)) {
              await this._promisifyRequest(store.put({
                key: vibeOriginalId,
                value: vibeCoId
              }));
              storedKeys.add(vibeOriginalId);
              count++;
            }
            
            // Also store @schema/vibe:todos format (extract "todos" from "@vibe/todos")
            // This is for backwards compatibility with code that might still use this format
            const vibeNamePart = vibeOriginalId.replace('@vibe/', '').replace('@schema/vibe:', '');
            if (vibeNamePart && vibeNamePart !== vibeOriginalId) {
              const vibeSchemaKey = `@schema/vibe:${vibeNamePart}`;
              if (!storedKeys.has(vibeSchemaKey)) {
                await this._promisifyRequest(store.put({
                  key: vibeSchemaKey,
                  value: vibeCoId
                }));
                storedKeys.add(vibeSchemaKey);
                count++;
              }
            }
          } else {
            console.warn(`[IndexedDBBackend] Vibe co-id not found in instanceCoIdMap. Available keys: ${Array.from(instanceCoIdMap.keys()).filter(k => k.includes('vibe') || k.includes('todos')).join(', ')}`);
          }
        }
      }
      
      // Ensure transaction completes before returning
      // Note: IndexedDB transactions auto-commit when all requests complete, but explicitly waiting ensures completion
      await transaction.complete;
      
      console.log(`[IndexedDBBackend] Stored ${count} co-id registry mappings`);
    } catch (error) {
      console.warn(`[IndexedDBBackend] Failed to store co-id registry:`, error);
      // Don't throw - registry is optional for backwards compatibility
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
