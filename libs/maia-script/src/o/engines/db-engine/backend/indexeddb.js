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
        
        if (!db.objectStoreNames.contains('coIdRegistry')) {
          db.createObjectStore('coIdRegistry', { keyPath: 'key' });
          console.log('[IndexedDBBackend] Created "coIdRegistry" object store');
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
    console.log('[IndexedDBBackend] Starting seed with co-id resolution...');
    
    // Import co-id generator and transformer
    const { generateCoIdForSchema, generateCoIdForInstance, generateCoIdForDataEntity, CoIdRegistry } = 
      await import('@MaiaOS/schemata/co-id-generator');
    const { transformSchemaForSeeding, transformInstanceForSeeding, validateNoNestedCoTypes } = 
      await import('@MaiaOS/schemata/schema-transformer');
    
    const coIdRegistry = new CoIdRegistry();
    
    // Flush configs and schemas only (preserve user data)
    await this.flush(['configs', 'schemas']);
    
    // Deduplicate schemas by $id (same schema may be registered under multiple keys)
    const uniqueSchemasBy$id = new Map();
    for (const [name, schema] of Object.entries(schemas)) {
      const schemaKey = schema.$id || `@schema/${name}`;
      // Only keep first occurrence of each $id (deduplicate)
      if (!uniqueSchemasBy$id.has(schemaKey)) {
        uniqueSchemasBy$id.set(schemaKey, { name, schema });
      }
    }
    
    // Phase 1: Generate co-ids for all unique schemas, build co-id map
    console.log('[IndexedDBBackend] Phase 1: Generating co-ids for schemas...');
    const schemaCoIdMap = new Map();
    
    for (const [schemaKey, { schema }] of uniqueSchemasBy$id) {
      // Generate co-id for schema
      const schemaCoId = generateCoIdForSchema(schema);
      
      schemaCoIdMap.set(schemaKey, schemaCoId);
      coIdRegistry.register(schemaKey, schemaCoId);
    }
    
    // Phase 2: Transform all schemas (replace human-readable refs with co-ids)
    console.log('[IndexedDBBackend] Phase 2: Transforming schemas...');
    const transformedSchemas = {};
    for (const [name, schema] of Object.entries(schemas)) {
      // Get the schema's $id to look up the co-id
      const schemaKey = schema.$id || `@schema/${name}`;
      const schemaCoId = schemaCoIdMap.get(schemaKey);
      
      if (!schemaCoId) {
        // This shouldn't happen if deduplication worked correctly
        throw new Error(`No co-id found for schema ${name} with $id ${schemaKey}`);
      }
      
      transformedSchemas[name] = transformSchemaForSeeding(schema, schemaCoIdMap);
      // Update $id to use co-id
      transformedSchemas[name].$id = schemaCoId;
    }
    
    // Phase 3: Seed schemas to IndexedDB with co-ids
    console.log('[IndexedDBBackend] Phase 3: Seeding schemas...');
    await this._seedSchemas(transformedSchemas, schemaCoIdMap);
    
    // Phase 3.5: Register data collection co-ids BEFORE transforming instances
    // This ensures query objects can be transformed to use co-ids during Phase 4
    // Store the co-ids so _seedData can reuse them (avoid duplicate registration)
    console.log('[IndexedDBBackend] Phase 3.5: Registering data collection co-ids for query object transformation...');
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
          console.log(`[IndexedDBBackend] Reusing existing co-id for ${schemaKey} (from schema): ${collectionCoId}`);
          // Still register collectionName → co-id mapping for data collection lookups
          coIdRegistry.register(collectionName, collectionCoId);
        } else {
          // Generate co-id for collection (same algorithm as _seedData)
          collectionCoId = generateCoIdForDataEntity({ collection: collectionName });
          
          // Register both @schema/collectionName and collectionName → collectionCoId
          // This allows transformInstanceForSeeding to resolve query objects
          coIdRegistry.register(schemaKey, collectionCoId);
          coIdRegistry.register(collectionName, collectionCoId);
          console.log(`[IndexedDBBackend] Pre-registered data collection: ${schemaKey} → ${collectionCoId}`);
        }
        
        // Store for reuse in _seedData
        dataCollectionCoIds.set(collectionName, collectionCoId);
      }
    }
    
    // Phase 4: Generate co-ids and transform all configs/instances
    // Strategy: Generate co-ids for all unique $id values first, then assign to all instances
    // This ensures instances with the same $id (e.g., list-item/list-item in actors, views, contexts)
    // get the same co-id, preventing duplicate registration errors
    console.log('[IndexedDBBackend] Phase 4: Generating co-ids and transforming configs/instances...');
    
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
    console.log(`[IndexedDBBackend] Phase 4: Collected ${allInstances.length} instances (deduplicated by $id)`);
    
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
        const instanceCoId = generateCoIdForInstance(firstOccurrence.instance);
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
      
      // Debug logging for vibe specifically
      if (key === 'vibe' || (instanceId && instanceId.startsWith('@vibe/'))) {
        console.log(`[IndexedDBBackend] Phase 4: Vibe instance - key: ${key}, $id: ${instanceId}, co-id: ${instanceCoId}`);
      }
    }
    
    // Step 3a: Extract subscriptions, inbox, tokens, and components as separate CoValues
    // NOTE: subscriptions and inboxes are now in separate .maia files (e.g., vibe.subscriptions.maia, vibe.inbox.maia)
    // No extraction logic needed - they're already clean and separated at the definition level
    /* LEGACY EXTRACTION LOGIC - NO LONGER USED
    const subscriptionsColists = []; // Store subscriptions colists to seed separately
    const inboxCoStreams = []; // Store inbox costreams to seed separately
    
    const extractActorCoValues = (configObj, prefix = '') => {
      for (const [key, value] of Object.entries(configObj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Check if this is an actor instance (strict check: must be actor schema or actor ID)
          if (value.$schema === '@schema/actor' || (value.$id && value.$id.startsWith('@actor/'))) {
            const actorId = value.$id || key;
            
            // Extract subscriptions as native colist CoValue (CRDT type)
            // Always ensure subscriptions property exists - create empty colist if missing
            if (value.subscriptions && Array.isArray(value.subscriptions)) {
              // Transform references in subscriptions array to co-ids BEFORE extraction
              const transformedSubscriptions = value.subscriptions.map(ref => {
                if (typeof ref === 'string' && !ref.startsWith('co_z')) {
                  // Check if it's a new @actor/instance format
                  if (ref.startsWith('@')) {
                    const coId = coIdByInstanceId.get(ref);
                    if (coId) {
                      return coId;
                    } else {
                      console.warn(`[IndexedDBBackend] No co-id found for subscriptions reference: ${ref}`);
                      return ref;
                    }
                  } else {
                    // Legacy format - try direct lookup
                    const coId = coIdByInstanceId.get(ref);
                    return coId || ref;
                  }
                }
                return ref;
              });
              
              // Array present: Extract and create native colist CoValue
              const subscriptionsCoId = generateCoIdForInstance({ type: 'subscriptions', actorId });
              
              // Store the transformed array (colist CRDT → Array for IndexedDB)
              subscriptionsColists.push({
                coId: subscriptionsCoId,
                schema: '@schema/subscriptions-colist',
                data: transformedSubscriptions // Transformed array with co-ids
              });
              
              value.subscriptions = subscriptionsCoId; // Replace with co-id reference
              
              const subscriptionsKey = `${prefix ? `${prefix}.` : ''}${key}.subscriptions`;
              coIdRegistry.register(subscriptionsKey, subscriptionsCoId);
              instanceCoIdMap.set(subscriptionsKey, subscriptionsCoId);
            } else if (!value.subscriptions) {
              // Property missing: Create empty native colist CoValue
              const subscriptionsCoId = generateCoIdForInstance({ type: 'subscriptions', actorId });
              
              // Store empty array (empty colist CRDT → empty array for IndexedDB)
              subscriptionsColists.push({
                coId: subscriptionsCoId,
                schema: '@schema/subscriptions-colist',
                data: [] // Empty native colist (CRDT format)
              });
              
              value.subscriptions = subscriptionsCoId; // Set co-id reference
              
              const subscriptionsKey = `${prefix ? `${prefix}.` : ''}${key}.subscriptions`;
              coIdRegistry.register(subscriptionsKey, subscriptionsCoId);
              instanceCoIdMap.set(subscriptionsKey, subscriptionsCoId);
            }
            
            // Extract inbox as native costream CoValue (CRDT type)
            // Always ensure inbox property exists - create empty costream if missing
            if (value.inbox && Array.isArray(value.inbox)) {
              // Array present: Extract and create native costream CoValue
              const inboxCoId = generateCoIdForInstance({ type: 'inbox', actorId });
              
              // Store the array directly (costream CRDT → Array for IndexedDB)
              inboxCoStreams.push({
                coId: inboxCoId,
                schema: '@schema/inbox',
                data: value.inbox // Native costream CRDT data (array format)
              });
              
              value.inbox = inboxCoId; // Replace with co-id reference
              
              const inboxKey = `${prefix ? `${prefix}.` : ''}${key}.inbox`;
              coIdRegistry.register(inboxKey, inboxCoId);
              instanceCoIdMap.set(inboxKey, inboxCoId);
            } else if (!value.inbox) {
              // Property missing: Create empty native costream CoValue
              const inboxCoId = generateCoIdForInstance({ type: 'inbox', actorId });
              
              // Store empty array (empty costream CRDT → empty array for IndexedDB)
              inboxCoStreams.push({
                coId: inboxCoId,
                schema: '@schema/inbox',
                data: [] // Empty native costream (CRDT format)
              });
              
              value.inbox = inboxCoId; // Set co-id reference
              
              const inboxKey = `${prefix ? `${prefix}.` : ''}${key}.inbox`;
              coIdRegistry.register(inboxKey, inboxCoId);
              instanceCoIdMap.set(inboxKey, inboxCoId);
            }
          }
          
          // Recurse into nested objects
          extractActorCoValues(value, prefix ? `${prefix}.${key}` : key);
        } else if (Array.isArray(value)) {
          // Handle arrays of instances
          value.forEach((item, index) => {
            if (item && typeof item === 'object' && (item.$schema === '@schema/actor' || (item.$id && item.$id.startsWith('@actor/')))) {
              const actorId = item.$id || `${key}[${index}]`;
              
              // Extract subscriptions as native colist CoValue (CRDT type)
              // Always ensure subscriptions property exists
              if (item.subscriptions && Array.isArray(item.subscriptions)) {
                // Transform references in subscriptions array to co-ids BEFORE extraction
                const transformedSubscriptions = item.subscriptions.map(ref => {
                  if (typeof ref === 'string' && !ref.startsWith('co_z')) {
                    // Check if it's a new @actor/instance format
                    if (ref.startsWith('@')) {
                      const coId = coIdByInstanceId.get(ref);
                      if (coId) {
                        return coId;
                      } else {
                        console.warn(`[IndexedDBBackend] No co-id found for subscriptions reference: ${ref}`);
                        return ref;
                      }
                    } else {
                      // Legacy format - try direct lookup
                      const coId = coIdByInstanceId.get(ref);
                      return coId || ref;
                    }
                  }
                  return ref;
                });
                
                // Array present: Extract and create native colist CoValue
                const subscriptionsCoId = generateCoIdForInstance({ type: 'subscriptions', actorId });
                
                subscriptionsColists.push({
                  coId: subscriptionsCoId,
                  schema: '@schema/subscriptions-colist',
                  data: transformedSubscriptions // Transformed array with co-ids
                });
                
                item.subscriptions = subscriptionsCoId; // Replace with co-id reference
                
                const subscriptionsKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].subscriptions`;
                coIdRegistry.register(subscriptionsKey, subscriptionsCoId);
                instanceCoIdMap.set(subscriptionsKey, subscriptionsCoId);
              } else if (!item.subscriptions) {
                // Property missing: Create empty native colist CoValue
                const subscriptionsCoId = generateCoIdForInstance({ type: 'subscriptions', actorId });
                
                subscriptionsColists.push({
                  coId: subscriptionsCoId,
                  schema: '@schema/subscriptions-colist',
                  data: [] // Empty native colist (CRDT format)
                });
                
                item.subscriptions = subscriptionsCoId; // Set co-id reference
                
                const subscriptionsKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].subscriptions`;
                coIdRegistry.register(subscriptionsKey, subscriptionsCoId);
                instanceCoIdMap.set(subscriptionsKey, subscriptionsCoId);
              }
              
              // Extract inbox as native costream CoValue (CRDT type)
              // Always ensure inbox property exists
              if (item.inbox && Array.isArray(item.inbox)) {
                // Array present: Extract and create native costream CoValue
                const inboxCoId = generateCoIdForInstance({ type: 'inbox', actorId });
                
                inboxCoStreams.push({
                  coId: inboxCoId,
                  schema: '@schema/inbox-costream',
                  data: item.inbox // Native costream CRDT data (array format)
                });
                
                item.inbox = inboxCoId; // Replace with co-id reference
                
                const inboxKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].inbox`;
                coIdRegistry.register(inboxKey, inboxCoId);
                instanceCoIdMap.set(inboxKey, inboxCoId);
              } else if (!item.inbox) {
                // Property missing: Create empty native costream CoValue
                const inboxCoId = generateCoIdForInstance({ type: 'inbox', actorId });
                
                inboxCoStreams.push({
                  coId: inboxCoId,
                  schema: '@schema/inbox-costream',
                  data: [] // Empty native costream (CRDT format)
                });
                
                item.inbox = inboxCoId; // Set co-id reference
                
                const inboxKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].inbox`;
                coIdRegistry.register(inboxKey, inboxCoId);
                instanceCoIdMap.set(inboxKey, inboxCoId);
              }
            }
          });
        }
      }
    };
    END OF LEGACY EXTRACTION LOGIC */
    
    // NOTE: All CoValues (subscriptions, inboxes, tokens, components) are now properly defined
    // in their own .maia files at the definition level. No runtime extraction hacks needed!
    
    /* LEGACY STYLE EXTRACTION - NO LONGER USED
    const extractStyleCoValues = (configObj, prefix = '') => {
      for (const [key, value] of Object.entries(configObj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Check if this is a style or brandStyle instance
          if (value.$schema === '@schema/style' || value.$schema === '@schema/brandStyle' || 
              (value.$id && (value.$id.startsWith('@style/') || value.$id.startsWith('@tokens/') || value.$id.startsWith('@components/')))) {
            const styleId = value.$id || key;
            
            // Extract tokens as native comap CoValue (CRDT type)
            if (value.tokens && typeof value.tokens === 'object' && !Array.isArray(value.tokens)) {
              // Object present: Extract and create native comap CoValue
              const tokensCoId = generateCoIdForInstance({ type: 'tokens', styleId });
              
              tokensComaps.push({
                coId: tokensCoId,
                schema: '@schema/tokens-comap',
                data: value.tokens // Native comap CRDT data (object format)
              });
              
              value.tokens = tokensCoId; // Replace with co-id reference
              
              const tokensKey = `${prefix ? `${prefix}.` : ''}${key}.tokens`;
              coIdRegistry.register(tokensKey, tokensCoId);
              instanceCoIdMap.set(tokensKey, tokensCoId);
            } else if (value.tokens && typeof value.tokens === 'string' && value.tokens.startsWith('@')) {
              // Already a reference - transform to co-id if needed
              if (!value.tokens.startsWith('co_z')) {
                const tokensCoId = coIdByInstanceId.get(value.tokens);
                if (tokensCoId) {
                  value.tokens = tokensCoId;
                } else {
                  console.warn(`[IndexedDBBackend] No co-id found for tokens reference: ${value.tokens}`);
                }
              }
            } else if (!value.tokens) {
              // Property missing: Create empty native comap CoValue
              const tokensCoId = generateCoIdForInstance({ type: 'tokens', styleId });
              
              tokensComaps.push({
                coId: tokensCoId,
                schema: '@schema/tokens-comap',
                data: {} // Empty native comap (CRDT format)
              });
              
              value.tokens = tokensCoId; // Set co-id reference
              
              const tokensKey = `${prefix ? `${prefix}.` : ''}${key}.tokens`;
              coIdRegistry.register(tokensKey, tokensCoId);
              instanceCoIdMap.set(tokensKey, tokensCoId);
            }
            
            // Extract components as native comap CoValue (CRDT type)
            if (value.components && typeof value.components === 'object' && !Array.isArray(value.components)) {
              // Object present: Extract and create native comap CoValue
              const componentsCoId = generateCoIdForInstance({ type: 'components', styleId });
              
              componentsComaps.push({
                coId: componentsCoId,
                schema: '@schema/components-comap',
                data: value.components // Native comap CRDT data (object format)
              });
              
              value.components = componentsCoId; // Replace with co-id reference
              
              const componentsKey = `${prefix ? `${prefix}.` : ''}${key}.components`;
              coIdRegistry.register(componentsKey, componentsCoId);
              instanceCoIdMap.set(componentsKey, componentsCoId);
            } else if (value.components && typeof value.components === 'string' && value.components.startsWith('@')) {
              // Already a reference - transform to co-id if needed
              if (!value.components.startsWith('co_z')) {
                const componentsCoId = coIdByInstanceId.get(value.components);
                if (componentsCoId) {
                  value.components = componentsCoId;
                } else {
                  console.warn(`[IndexedDBBackend] No co-id found for components reference: ${value.components}`);
                }
              }
            } else if (!value.components) {
              // Property missing: Create empty native comap CoValue
              const componentsCoId = generateCoIdForInstance({ type: 'components', styleId });
              
              componentsComaps.push({
                coId: componentsCoId,
                schema: '@schema/components-comap',
                data: {} // Empty native comap (CRDT format)
              });
              
              value.components = componentsCoId; // Set co-id reference
              
              const componentsKey = `${prefix ? `${prefix}.` : ''}${key}.components`;
              coIdRegistry.register(componentsKey, componentsCoId);
              instanceCoIdMap.set(componentsKey, componentsCoId);
            }
          }
          
          // Recurse into nested objects
          extractStyleCoValues(value, prefix ? `${prefix}.${key}` : key);
        } else if (Array.isArray(value)) {
          // Handle arrays of instances
          value.forEach((item, index) => {
            if (item && typeof item === 'object' && (item.$schema === '@schema/style' || item.$schema === '@schema/brandStyle')) {
              const styleId = item.$id || `${key}[${index}]`;
              
              // Extract tokens
              if (item.tokens && typeof item.tokens === 'object' && !Array.isArray(item.tokens)) {
                const tokensCoId = generateCoIdForInstance({ type: 'tokens', styleId });
                tokensComaps.push({
                  coId: tokensCoId,
                  schema: '@schema/tokens-comap',
                  data: item.tokens
                });
                item.tokens = tokensCoId;
                const tokensKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].tokens`;
                coIdRegistry.register(tokensKey, tokensCoId);
                instanceCoIdMap.set(tokensKey, tokensCoId);
              } else if (item.tokens && typeof item.tokens === 'string' && item.tokens.startsWith('@') && !item.tokens.startsWith('co_z')) {
                const tokensCoId = coIdByInstanceId.get(item.tokens);
                if (tokensCoId) {
                  item.tokens = tokensCoId;
                }
              } else if (!item.tokens) {
                const tokensCoId = generateCoIdForInstance({ type: 'tokens', styleId });
                tokensComaps.push({
                  coId: tokensCoId,
                  schema: '@schema/tokens-comap',
                  data: {}
                });
                item.tokens = tokensCoId;
                const tokensKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].tokens`;
                coIdRegistry.register(tokensKey, tokensCoId);
                instanceCoIdMap.set(tokensKey, tokensCoId);
              }
              
              // Extract components
              if (item.components && typeof item.components === 'object' && !Array.isArray(item.components)) {
                const componentsCoId = generateCoIdForInstance({ type: 'components', styleId });
                componentsComaps.push({
                  coId: componentsCoId,
                  schema: '@schema/components-comap',
                  data: item.components
                });
                item.components = componentsCoId;
                const componentsKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].components`;
                coIdRegistry.register(componentsKey, componentsCoId);
                instanceCoIdMap.set(componentsKey, componentsCoId);
              } else if (item.components && typeof item.components === 'string' && item.components.startsWith('@') && !item.components.startsWith('co_z')) {
                const componentsCoId = coIdByInstanceId.get(item.components);
                if (componentsCoId) {
                  item.components = componentsCoId;
                }
              } else if (!item.components) {
                const componentsCoId = generateCoIdForInstance({ type: 'components', styleId });
                componentsComaps.push({
                  coId: componentsCoId,
                  schema: '@schema/components-comap',
                  data: {}
                });
                item.components = componentsCoId;
                const componentsKey = `${prefix ? `${prefix}.` : ''}${key}[${index}].components`;
                coIdRegistry.register(componentsKey, componentsCoId);
                instanceCoIdMap.set(componentsKey, componentsCoId);
              }
            }
          });
        }
      }
    }; */
    
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
          // Debug logging for vibe specifically
          console.log(`[IndexedDBBackend] Phase 4: Transforming vibe - $id before transform: ${configValue.$id}`);
          transformedConfigs[configType] = transformInstanceForSeeding(configValue, coIdRegistry.getAll());
          console.log(`[IndexedDBBackend] Phase 4: Transforming vibe - $id after transform: ${transformedConfigs[configType].$id}`);
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
    
    // Phase 5: Validate all configs/instances - REJECT if nested co-types found
    console.log('[IndexedDBBackend] Phase 5: Validating configs (checking for nested co-types)...');
    // Note: Instance validation happens at runtime, not during seeding
    // We only validate schemas for nested co-types
    
    // Phase 6: Seed configs/instances to IndexedDB with co-ids
    console.log('[IndexedDBBackend] Phase 6: Seeding configs/instances...');
    await this._seedConfigs(transformedConfigs, instanceCoIdMap, generateCoIdForInstance);
    
    // Phase 7: Generate co-ids for all data entities (todo items, etc.) - under the hood
    console.log('[IndexedDBBackend] Phase 7: Generating co-ids for data entities...');
    // Data entities get co-ids generated automatically during creation
    // For seeding, we'll generate them here
    
    // Phase 8: Seed data entities to IndexedDB with co-ids (no hardcoded `id` field)
    const hasExistingData = await this._hasExistingData();
    if (!hasExistingData) {
      console.log('[IndexedDBBackend] Phase 8: Seeding initial data...');
      try {
        // Pass dataCollectionCoIds map to reuse co-ids from Phase 3.5 (avoid duplicate registration)
        await this._seedData(data, generateCoIdForDataEntity, coIdRegistry, dataCollectionCoIds);
      } catch (error) {
        console.error('[IndexedDBBackend] Error seeding data:', error);
        throw error;
      }
    } else {
      console.log('[IndexedDBBackend] Existing data found, skipping data seed to preserve user data');
    }
    
    // Phase 8b: Store ALL human-readable → co-id mappings in coIdRegistry store
    // Pass original configs to build @schema/type:path mappings correctly
    // Must be called AFTER _seedData or _registerExistingDataCollections so data collection mappings are included
    // Always run this phase even if previous phases had errors (to populate registry)
    console.log('[IndexedDBBackend] Phase 8b: Storing co-id registry mappings...');
    try {
      await this._storeCoIdRegistry(coIdRegistry, schemaCoIdMap, instanceCoIdMap, configs);
    } catch (error) {
      console.error('[IndexedDBBackend] Error storing co-id registry:', error);
      throw error;
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
   * Seed configs into database with co-ids
   * @private
   * @param {Object} configs - Transformed configs with co-ids
   * @param {Map<string, string>} instanceCoIdMap - Map of instance key → co-id
   * @param {Function} generateCoIdForInstance - Function to generate co-id for instances
   */
  async _seedConfigs(configs, instanceCoIdMap, generateCoIdForInstance) {
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
          vibeCoId = generateCoIdForInstance(configs.vibe);
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
        // Ensure config has a co-id (required!)
        const coId = config.$id || instanceCoIdMap.get(`${configType}.${path}`) || generateCoId(config);
        
        if (!coId || !coId.startsWith('co_z')) {
          throw new Error(`Config ${configType}:${path} missing valid co-id. Expected co-id starting with 'co_z', got: ${coId}`);
        }
        
        // Set $id to co-id (required!)
        config.$id = coId;
        
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
    count += await seedConfigType('style', configs.styles, generateCoIdForInstance);
    
    // Seed actors
    count += await seedConfigType('actor', configs.actors, generateCoIdForInstance);
    
    // Seed views
    count += await seedConfigType('view', configs.views, generateCoIdForInstance);
    
    // Seed contexts
    count += await seedConfigType('context', configs.contexts, generateCoIdForInstance);
    
    // Seed states
    count += await seedConfigType('state', configs.states, generateCoIdForInstance);
    
    // Seed interfaces
    count += await seedConfigType('interface', configs.interfaces, generateCoIdForInstance);
    
    // Seed subscriptions (colist CoValues)
    count += await seedConfigType('subscriptions', configs.subscriptions, generateCoIdForInstance);
    
    // Seed inboxes (costream CoValues)
    count += await seedConfigType('inbox', configs.inboxes, generateCoIdForInstance);
    
    // Note: subscriptions/inboxes/tokens/components all handled cleanly at the .maia definition level
    
    // Seed tool definitions
    count += await seedConfigType('tool', configs.tool, generateCoIdForInstance);
    
    console.log(`[IndexedDBBackend] Seeded ${count} configs`);
  }
  
  /**
   * Seed schemas into database with co-ids
   * @private
   * @param {Object} schemas - Transformed schemas with co-ids
   * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
   */
  async _seedSchemas(schemas, coIdMap) {
    const transaction = this.db.transaction(['schemas'], 'readwrite');
    const store = transaction.objectStore('schemas');
    
    let count = 0;
    
    for (const [name, schema] of Object.entries(schemas)) {
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
    
    console.log(`[IndexedDBBackend] Seeded ${count} schemas with co-ids`);
  }
  
  /**
   * Seed initial data into database with co-ids
   * @private
   * @param {Object} data - Initial data collections
   * @param {Function} generateCoIdForDataEntity - Function to generate co-id for data entity
   * @param {CoIdRegistry} coIdRegistry - Registry to store mappings
   * @param {Map<string, string>} [dataCollectionCoIds] - Pre-registered collection co-ids from Phase 3.5 (to avoid duplicate registration)
   */
  async _seedData(data, generateCoIdForDataEntity, coIdRegistry, dataCollectionCoIds = null) {
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
          const coId = item.$id || generateCoIdForDataEntity(item);
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
      
      console.log(`[IndexedDBBackend] Seeded ${collection.length || 0} items for collection ${collectionName} (schema: ${schemaCoId})`);
    }
    
    console.log(`[IndexedDBBackend] Seeded ${totalItems} total data items`);
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
   * Get single item by schema + key
   * @param {string} schema - Schema reference (@schema/actor, @schema/todos)
   * @param {string} key - Item key (e.g., 'vibe/vibe' or co-id 'co_z...')
   * @returns {Promise<any>} Item value
   */
  async get(schema, key) {
    const storeName = this._getStoreName(schema);
    
    // If key is already a co-id, use it directly
    if (key && key.startsWith('co_z')) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
      const request = store.get(key);
    const result = await this._promisifyRequest(request);
    return result?.value;
    }
    
    // Resolve human-readable key to co-id via registry
    // Try multiple key formats: full schema path, simple key, etc.
    const possibleKeys = [
      `${schema}:${key}`,  // @schema/vibe:todos
      key,                  // todos, vibe/vibe
      `@schema/${key}`      // @schema/todos (for schemas)
    ];
    
    let coId = null;
    for (const possibleKey of possibleKeys) {
      coId = await this.resolveHumanReadableKey(possibleKey);
      if (coId) {
        break;
      }
    }
    
    if (!coId) {
      console.warn(`[IndexedDBBackend] Could not resolve key "${key}" for schema "${schema}" to co-id`);
      return null;
    }
    
    // Fetch actual entity using co-id
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(coId);
    const result = await this._promisifyRequest(request);
    
    return result?.value || null;
  }
  
  /**
   * Query collection (optionally with filter)
   * @param {string} schema - Schema reference (@schema/todos)
   * @param {Object} filter - Filter criteria {field: value} or null
   * @returns {Promise<Array>} Array of items
   */
  async query(schema, filter = null) {
    const storeName = this._getStoreName(schema);
    
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    // For configs and schemas, we need to get all entries and filter by co-id pattern
    // For data collections, use the schema as key
    if (storeName === 'configs' || storeName === 'schemas') {
      // Get all entries and filter to only co-id keys (skip human-readable mappings)
      const request = store.getAll();
      const allResults = await this._promisifyRequest(request);
      
      // Filter to only entries with co-id keys (actual configs/schemas, not mappings)
      const items = (allResults || [])
        .filter(item => item.key && item.key.startsWith('co_z'))
        .map(item => item.value);
      
      // Apply filter if provided
      if (filter && items.length > 0) {
        return this._applyFilter(items, filter);
      }
      
      return items;
    } else {
      // Data items: Iterate through all items and filter by $schema field
      // Schema should already be a co-id (transformed during seeding)
      if (!schema.startsWith('co_z')) {
        console.error(`[IndexedDBBackend] Data collection schema must be a co-id, got: ${schema}. Query objects should be transformed during seeding.`);
        return [];
      }
      
      // Get all items from data store
      const request = store.getAll();
      const allResults = await this._promisifyRequest(request);
      
      // Filter items by $schema field matching the query schema co-id
      let items = (allResults || [])
        .map(item => item.value)
        .filter(item => item && item.$schema === schema);
      
      // Apply filter if provided
      if (filter && items.length > 0) {
        items = this._applyFilter(items, filter);
      }
      
      // Normalize items: add id field from $id for view compatibility ($$id syntax)
      items = items.map(item => ({
        ...item,
        id: item.$id
      }));
      
      return items;
    }
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
    const { generateCoIdForDataEntity } = await import('@MaiaOS/schemata/co-id-generator');
    
    // Generate co-id for the item
    const coId = generateCoIdForDataEntity(data);
    
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
    console.log(`[IndexedDBBackend] Transaction committed for ${schema}`);
    
    console.log(`[IndexedDBBackend] Created record in ${schema}:`, record);
    
    // Notify observers by re-querying (simpler than maintaining collection state)
    const updatedItems = await this.query(schema, null);
    this.notifyWithData(schema, updatedItems);
    
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
    console.log(`[IndexedDBBackend] Transaction committed for ${schema}`);
    
    console.log(`[IndexedDBBackend] Updated record in ${schema}:`, updatedRecord);
    
    // Notify observers by re-querying
    const updatedItems = await this.query(schema, null);
    this.notifyWithData(schema, updatedItems);
    
    return updatedRecord;
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
    console.log(`[IndexedDBBackend] Transaction committed for ${schema}`);
    
    console.log(`[IndexedDBBackend] Deleted record from ${schema}:`, id);
    
    // Notify observers by re-querying
    const updatedItems = await this.query(schema, null);
    this.notifyWithData(schema, updatedItems);
    
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
      // Normalize items: add id field from $id for view compatibility ($$id syntax)
      const normalizedCollection = updatedCollection.map(item => ({
        ...item,
        id: item.$id
      }));
      
      // Apply filter to updated collection
      const filteredData = observer.filter ? this._applyFilter(normalizedCollection, observer.filter) : normalizedCollection;
      observer.callback(filteredData);
    });
  }
  
  /**
   * Notify all observers of schema changes (queries database)
   * @param {string} schema - Schema co-id (co_z...) for data collections
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
    const configTypes = ['actor', 'view', 'style', 'state', 'context', 'interface', 'vibe', 'tool', 'subscriptions-colist', 'inbox'];
    
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
      if (!schemaKey.startsWith('co_z')) {
        // Resolve human-readable key to co-id via registry
        schemaCoId = await this.resolveHumanReadableKey(schemaKey);
        if (!schemaCoId) {
          console.warn(`[IndexedDBBackend] Could not resolve schema key "${schemaKey}" to co-id`);
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
            // Get co-id - config.$id should already be a co-id after transformation
            // But also check instanceCoIdMap as fallback
            let coId = null;
            
            // First, check if config.$id is already a co-id (after transformation)
            if (config.$id && config.$id.startsWith('co_z')) {
              coId = config.$id;
            } else {
              // Fallback: try to get from instanceCoIdMap
              // Keys in instanceCoIdMap are like "actors.vibe/vibe" or just "vibe/vibe"
              const possibleKeys = [
                `${configTypeKey}.${path}`,
                path,
                config.$id || path
              ];
              
              for (const key of possibleKeys) {
                if (instanceCoIdMap.has(key)) {
                  coId = instanceCoIdMap.get(key);
                  break;
                }
              }
            }
            
            if (coId) {
              const fullKey = `@schema/${configType}:${path}`;
              if (!storedKeys.has(fullKey)) {
                await this._promisifyRequest(store.put({
                  key: fullKey,
                  value: coId
                }));
                storedKeys.add(fullKey);
                count++;
              }
            } else {
              console.warn(`[IndexedDBBackend] Could not find co-id for config ${configType}:${path}`);
            }
          }
        }
        
        // Special handling for vibe
        if (configs.vibe && instanceCoIdMap) {
          const vibeCoId = instanceCoIdMap.get('vibe') || instanceCoIdMap.get('todos');
          if (vibeCoId) {
            // Find original $id by reverse lookup in instanceCoIdMap
            // The original $id was registered in Phase 4 (e.g., "todos")
            let vibeOriginalId = null;
            for (const [humanId, mappedCoId] of instanceCoIdMap.entries()) {
              if (mappedCoId === vibeCoId && humanId !== 'vibe' && !humanId.includes('.')) {
                vibeOriginalId = humanId;
                break;
              }
            }
            // Fallback to 'todos' if not found
            if (!vibeOriginalId) {
              vibeOriginalId = 'todos';
            }
            
            // Store @schema/vibe:todos (using original $id)
            const vibeKey = `@schema/vibe:${vibeOriginalId}`;
            if (!storedKeys.has(vibeKey)) {
              await this._promisifyRequest(store.put({
                key: vibeKey,
                value: vibeCoId
              }));
              storedKeys.add(vibeKey);
              count++;
            }
            
            // Also store @schema/vibe:Todo List (using name if available)
            if (configs.vibe.name) {
              const vibeNameKey = `@schema/vibe:${configs.vibe.name}`;
              if (!storedKeys.has(vibeNameKey)) {
                await this._promisifyRequest(store.put({
                  key: vibeNameKey,
                  value: vibeCoId
                }));
                storedKeys.add(vibeNameKey);
                count++;
              }
            }
          }
        }
      }
      
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
