/**
 * MaiaOS Kernel - v0.4
 * 
 * Single entry point for the MaiaOS Operating System
 * Central source of truth for booting and managing the OS
 * Imports engines from @MaiaOS/script and orchestrates them
 * 
 * Usage:
 *   import { MaiaOS } from '@MaiaOS/kernel';
 *   const os = await MaiaOS.boot(config);
 */

// Import all engines from @MaiaOS/script
import { ActorEngine } from '@MaiaOS/script';
import { ViewEngine } from '@MaiaOS/script';
import { StyleEngine } from '@MaiaOS/script';
import { StateEngine } from '@MaiaOS/script';
import { MaiaScriptEvaluator } from '@MaiaOS/script';
import { ModuleRegistry } from '@MaiaOS/script';
import { ToolEngine } from '@MaiaOS/script';
import { SubscriptionEngine } from '@MaiaOS/script';
import { DBEngine } from '@MaiaOS/script';
// Import validation helper
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
// Import all schemas for seeding
import * as schemata from '@MaiaOS/schemata';
// Import ValidationEngine for meta schema validation
import { ValidationEngine } from '@MaiaOS/schemata/validation.engine';
// Import schema loader utility
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';

/**
 * MaiaOS - Operating System for Actor-based Applications
 */
export class MaiaOS {
  constructor() {
    this.moduleRegistry = null;
    this.evaluator = null;
    this.toolEngine = null;
    this.stateEngine = null;
    this.styleEngine = null;
    this.viewEngine = null;
    this.actorEngine = null;
    this.subscriptionEngine = null; // Subscription management engine
    this.dbEngine = null; // Database operation engine
    
    // CoJSON backend support (for maia-city compatibility)
    this._node = null;
    this._account = null;
  }
  
  /**
   * Compatibility property for maia-city and other tools
   * Exposes node and account in the same structure as createMaiaOS()
   */
  get id() {
    if (!this._node || !this._account) {
      return null;
    }
    return {
      maiaId: this._account,
      node: this._node
    };
  }
  
  /**
   * Get all CoValues from the node (for maia-city compatibility)
   * @returns {Array} Array of CoValue metadata
   */
  getAllCoValues() {
    if (!this._node) {
      return [];
    }
    
    const allCoValues = [];
    const coValuesMap = this._node.coValues;
    
    if (coValuesMap && typeof coValuesMap.entries === 'function') {
      for (const [coId, coValueCore] of coValuesMap.entries()) {
        try {
          if (!coValueCore.isAvailable()) {
            allCoValues.push({
              id: coId,
              type: 'loading',
              schema: null,
              headerMeta: null,
              keys: 'N/A',
              content: null,
              createdAt: null
            });
            continue;
          }
          
          const content = coValueCore.getCurrentContent();
          const header = coValueCore.verified?.header;
          const headerMeta = header?.meta || null;
          const schema = headerMeta?.$schema || null;
          const createdAt = header?.createdAt || null;
          
          let keysCount = 'N/A';
          if (content && content.keys && typeof content.keys === 'function') {
            try {
              const keys = content.keys();
              keysCount = keys.length;
            } catch (e) {
              // Ignore
            }
          }
          
          const type = content?.type || 'unknown';
          
          let specialContent = null;
          if (type === 'costream') {
            try {
              const streamData = content.toJSON();
              if (streamData instanceof Uint8Array) {
                specialContent = {
                  type: 'stream',
                  itemCount: 'binary',
                  preview: `${streamData.length} bytes`
                };
              } else if (streamData && typeof streamData === 'object') {
                const allItems = [];
                for (const sessionKey in streamData) {
                  if (Array.isArray(streamData[sessionKey])) {
                    allItems.push(...streamData[sessionKey]);
                  }
                }
                specialContent = {
                  type: 'stream',
                  itemCount: allItems.length,
                  preview: allItems.slice(0, 3)
                };
              }
            } catch (e) {
              // Ignore
            }
          } else if (type === 'coplaintext') {
            try {
              specialContent = {
                type: 'plaintext',
                content: content.text || content.toString()
              };
            } catch (e) {
              // Ignore
            }
          }
          
          allCoValues.push({
            id: coId,
            type: type,
            schema: schema,
            headerMeta: headerMeta,
            keys: keysCount,
            content: specialContent || content,
            createdAt: createdAt
          });
        } catch (error) {
          console.warn(`Error processing CoValue ${coId}:`, error);
          allCoValues.push({
            id: coId,
            type: 'error',
            schema: null,
            headerMeta: null,
            keys: 'N/A',
            content: null,
            createdAt: null,
            error: error.message
          });
        }
      }
    }
    
    return allCoValues;
  }

  /**
   * Boot the operating system
   * @param {Object} config - Boot configuration
   * @param {Object} [config.node] - LocalNode instance (required for CoJSON backend if backend not provided)
   * @param {Object} [config.account] - RawAccount instance (required for CoJSON backend if backend not provided)
   * @param {Object} [config.backend] - Pre-initialized backend (alternative to node+account)
   * @param {Object} [config.registry] - Config registry for seeding
   * @returns {Promise<MaiaOS>} Booted OS instance
   * @throws {Error} If neither backend nor node+account is provided
   */
  static async boot(config = {}) {
    const os = new MaiaOS();
    
    // Booting MaiaOS
    
    // Store node and account for CoJSON backend compatibility
    if (config.node && config.account) {
      os._node = config.node;
      os._account = config.account;
    }
    
    // Initialize database (requires CoJSON backend via node+account or pre-initialized backend)
    const backend = await MaiaOS._initializeDatabase(os, config);
    
    // Seed database if registry provided
    if (config.registry) {
      await MaiaOS._seedDatabase(os, backend, config);
    }
    
    // Initialize engines
    MaiaOS._initializeEngines(os, config);
    
    // Load modules
    await MaiaOS._loadModules(os, config);
    
    // MaiaOS booted
    
    return os;
  }

  /**
   * Initialize database backend and engine
   * Requires either a pre-initialized backend or CoJSON node+account
   * @param {MaiaOS} os - OS instance
   * @param {Object} config - Boot configuration
   * @param {Object} [config.node] - LocalNode instance (required for CoJSON backend)
   * @param {Object} [config.account] - RawAccount instance (required for CoJSON backend)
   * @param {Object} [config.backend] - Pre-initialized backend (alternative to node+account)
   * @returns {Promise<DBAdapter>} Initialized backend
   * @throws {Error} If neither backend nor node+account is provided
   */
  static async _initializeDatabase(os, config = {}) {
    // If backend is provided, use it
    if (config.backend) {
      os.dbEngine = new DBEngine(config.backend);
      return config.backend;
    }
    
    // If node and account are provided, use CoJSON backend
    if (config.node && config.account) {
      const { CoJSONBackend } = await import('@MaiaOS/db');
      const backend = new CoJSONBackend(config.node, config.account);
      os.dbEngine = new DBEngine(backend);
      // Set dbEngine on backend for runtime schema validation in create functions
      backend.dbEngine = os.dbEngine;
      // Using CoJSON backend
      return backend;
    }
    
    // No backend provided - throw error
    throw new Error(
      'MaiaOS.boot() requires either a backend or node+account for CoJSON backend. ' +
      'Provide either: { backend: <DBAdapter> } or { node: <LocalNode>, account: <RawAccount> }'
    );
  }

  /**
   * Collect schemas from schemata module
   * @returns {Object} Schemas object
   */
  static _collectSchemas() {
    const schemas = {};
    
    // Get all schema definitions from schemata module
    if (typeof schemata.getAllSchemas === 'function') {
      Object.assign(schemas, schemata.getAllSchemas());
    }
    
    // Add meta schema for validation
    if (typeof schemata.getMetaSchema === 'function') {
      schemas['meta-schema'] = schemata.getMetaSchema();
    }
    
    return schemas;
  }

  /**
   * Validate schemas against meta schema
   * @param {Object} schemas - Schemas to validate
   * @param {ValidationEngine} validationEngine - Validation engine instance
   * @throws {Error} If any schema fails validation
   */
  static async _validateSchemas(schemas, validationEngine) {
    for (const [name, schema] of Object.entries(schemas)) {
      const result = await validationEngine.validateSchemaAgainstMeta(schema);
      if (!result.valid) {
        const errorDetails = result.errors
          .map(err => `  - ${err.instancePath}: ${err.message}`)
          .join('\n');
        console.error(`❌ Schema '${name}' failed meta schema validation:\n${errorDetails}`);
        throw new Error(`Schema '${name}' is not valid JSON Schema`);
      }
    }
  }

  /**
   * Seed database with configs, schemas, and tool definitions
   * @param {MaiaOS} os - OS instance
   * @param {DBAdapter} backend - Database backend (CoJSONBackend)
   * @param {Object} config - Boot configuration
   */
  static async _seedDatabase(os, backend, config) {
    // Seeding database
    
    // Import tool definitions
    const { getAllToolDefinitions } = await import('@MaiaOS/tools');
    const toolDefs = getAllToolDefinitions();
    
    // Merge tool definitions into registry
    const configsWithTools = {
      ...config.registry,
      tool: toolDefs // Add tool definitions under 'tool' key
    };
    
    // Collect schemas
    const schemas = MaiaOS._collectSchemas();
    
    // Validate schemas against meta schema before seeding
    // Metaschema is registered during ValidationEngine initialization
    const validationEngine = new ValidationEngine();
    await validationEngine.initialize();
    await MaiaOS._validateSchemas(schemas, validationEngine);
    
    // Seed database
    // Merge registry default data with any existing data (don't override, merge)
    const defaultData = config.registry?.data || {};
    const seedData = {
      todos: defaultData.todos || [], // Use registry default todos if available
      ...defaultData // Include any other default data from registry
    };
    
    await os.dbEngine.execute({
      op: 'seed',
      configs: configsWithTools,
      schemas: schemas,
      data: seedData
    });
    
    // Database seeded successfully
    
    // Set schema resolver on validation helper singleton for engines to use
    // Pass dbEngine to use operations API (preferred over resolver function)
    const { setSchemaResolver } = await import('@MaiaOS/schemata/validation.helper');
    setSchemaResolver(null, os.dbEngine); // Pass dbEngine to use operations API
  }

  /**
   * Initialize all engines and wire dependencies
   * @param {MaiaOS} os - OS instance
   * @param {Object} config - Boot configuration
   */
  static _initializeEngines(os, config) {
    // Initialize module registry
    os.moduleRegistry = new ModuleRegistry();
    
    // Initialize engines
    // CRITICAL: Pass dbEngine to evaluator for runtime schema validation (no fallbacks)
    os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry, { dbEngine: os.dbEngine });
    os.toolEngine = new ToolEngine(os.moduleRegistry);
    
    // Store engines in registry for module access
    os.moduleRegistry._toolEngine = os.toolEngine;
    os.moduleRegistry._dbEngine = os.dbEngine;
    
    os.stateEngine = new StateEngine(os.toolEngine, os.evaluator);
    os.styleEngine = new StyleEngine();
    // Clear cache on boot in development only
    if (config.isDevelopment || import.meta.env.DEV) {
      os.styleEngine.clearCache();
    }
    os.viewEngine = new ViewEngine(os.evaluator, null, os.moduleRegistry);
    
    // Initialize ActorEngine (will receive SubscriptionEngine after it's created)
    os.actorEngine = new ActorEngine(
      os.styleEngine,
      os.viewEngine,
      os.moduleRegistry,
      os.toolEngine,
      os.stateEngine
    );
    
    // Initialize SubscriptionEngine (context-driven reactive subscriptions)
    os.subscriptionEngine = new SubscriptionEngine(os.dbEngine, os.actorEngine);
    
    // Pass database engine to engines (for internal config loading)
    os.actorEngine.dbEngine = os.dbEngine;
    os.viewEngine.dbEngine = os.dbEngine;
    os.styleEngine.dbEngine = os.dbEngine;
    os.stateEngine.dbEngine = os.dbEngine;
    
    // Pass engines to SubscriptionEngine (for config subscriptions)
    os.subscriptionEngine.setEngines({
      viewEngine: os.viewEngine,
      styleEngine: os.styleEngine,
      stateEngine: os.stateEngine
    });
    
    // Pass SubscriptionEngine to ActorEngine
    os.actorEngine.subscriptionEngine = os.subscriptionEngine;
    
    // Store reference to MaiaOS in actorEngine (for @db tool access)
    os.actorEngine.os = os;
    
    // Set actorEngine reference in viewEngine (circular dependency)
    os.viewEngine.actorEngine = os.actorEngine;
    
    // Set actorEngine reference in stateEngine (for unified event flow through inbox)
    os.stateEngine.actorEngine = os.actorEngine;
  }

  /**
   * Load modules
   * @param {MaiaOS} os - OS instance
   * @param {Object} config - Boot configuration
   */
  static async _loadModules(os, config) {
    // Load modules (default: db, core, dragdrop, interface)
    const modules = config.modules || ['db', 'core', 'dragdrop', 'interface'];
    
    for (const moduleName of modules) {
      try {
        await os.moduleRegistry.loadModule(moduleName);
      } catch (error) {
        console.error(`Failed to load module "${moduleName}":`, error);
      }
    }
  }

  /**
   * Create an actor
   * @param {string} actorPath - Path to actor.maia file
   * @param {HTMLElement} container - Container element
   * @returns {Promise<Object>} Created actor
   */
  async createActor(actorPath, container) {
    const actorConfig = await this.actorEngine.loadActor(actorPath);
    const actor = await this.actorEngine.createActor(actorConfig, container);
    return actor;
  }

  /**
   * Load a vibe (app manifest) from file and create its root actor
   * @param {string} vibePath - Path to vibe manifest
   * @param {HTMLElement} container - Container element
   * @returns {Promise<{vibe: Object, actor: Object}>} Vibe metadata and actor instance
   */
  async loadVibe(vibePath, container) {
    // Fetch vibe manifest
    const response = await fetch(vibePath);
    if (!response.ok) {
      throw new Error(`Failed to load vibe: ${vibePath}`);
    }
    
    const vibe = await response.json();
    
    // Validate vibe structure using schema
    // Note: When loading from file, we can't use fromCoValue pattern since it's not in the database yet
    // For file-based loading, we skip schema validation (vibe will be validated when seeded)
    // If you need validation, load the vibe schema by co-id or use loadVibeFromDatabase instead
    
    // Resolve actor path relative to vibe location
    const vibeDir = vibePath.substring(0, vibePath.lastIndexOf('/'));
    const actorPath = `${vibeDir}/${vibe.actor}`;
    
    // Create root actor
    const actor = await this.createActor(actorPath, container);
    
    console.log(`✅ Vibe loaded: ${vibe.name}`);
    
    return { vibe, actor };
  }

  /**
   * Load a vibe from account.vibes using the abstracted operations API
   * @param {string} vibeKey - Vibe key in account.vibes (e.g., "todos")
   * @param {HTMLElement} container - Container element
   * @returns {Promise<{vibe: Object, actor: Object}>} Vibe metadata and actor instance
   */
  async loadVibeFromAccount(vibeKey, container) {
    if (!this.dbEngine || !this._account) {
      throw new Error('[Kernel] Cannot load vibe from account - dbEngine or account not available');
    }

    const account = this._account;
    
    // Step 1: Read account CoMap using abstracted operations API
    const accountStore = await this.dbEngine.execute({
      op: 'read',
      schema: '@account',
      key: account.id
    });
    
    const accountData = accountStore.value;
    if (!accountData) {
      throw new Error('[Kernel] Failed to read account CoMap');
    }
    
    // Step 2: Extract vibes CoMap co-id from account data
    // Operations API returns flat objects: {id: '...', profile: '...', vibes: '...'}
    const vibesId = accountData.vibes;
    if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_')) {
      throw new Error(`[Kernel] account.vibes not found. Make sure the vibe was seeded correctly. Account data: ${JSON.stringify({id: accountData.id, hasVibes: !!accountData.vibes})}`);
    }
    
    // Step 3: Read account.vibes CoMap using abstracted operations API
    // Backend's _readSingleItem waits for CoValue to be loaded before returning store
    const vibesStore = await this.dbEngine.execute({
      op: 'read',
      schema: vibesId,
      key: vibesId
    });
    
    // Store is already loaded by backend (operations API abstraction)
    const vibesData = vibesStore.value;
    
    if (!vibesData || vibesData.error) {
      throw new Error(`[Kernel] account.vibes CoMap not found or error (co-id: ${vibesId}): ${vibesData?.error || 'Unknown error'}. Make sure the vibe was seeded correctly.`);
    }
    
    // Operations API returns flat objects: {id: '...', todos: 'co_...', ...}
    // Extract vibe co-id directly from flat object
    const vibeCoId = vibesData[vibeKey];
    if (!vibeCoId || typeof vibeCoId !== 'string' || !vibeCoId.startsWith('co_')) {
      const availableVibes = Object.keys(vibesData).filter(k => k !== 'id' && typeof vibesData[k] === 'string' && vibesData[k].startsWith('co_'));
      throw new Error(`[Kernel] Vibe '${vibeKey}' not found in account.vibes. Available vibes: ${availableVibes.join(', ')}`);
    }
    
    // Step 5: Load vibe using co-id (reuse existing loadVibeFromDatabase logic)
    return await this.loadVibeFromDatabase(vibeCoId, container, vibeKey);
  }

  /**
   * Load a vibe from database (maia.db)
   * @param {string} vibeId - Vibe ID (co-id or human-readable like "@vibe/todos")
   * @param {HTMLElement} container - Container element
   * @param {string} [vibeKey] - Optional vibe key for actor reuse tracking (e.g., 'todos')
   * @returns {Promise<{vibe: Object, actor: Object}>} Vibe metadata and actor instance
   */
  async loadVibeFromDatabase(vibeId, container, vibeKey = null) {
    // Vibe ID should already be co-id (transformed during seeding)
    // If not co-id, it's a seeding error - fail fast
    if (!vibeId.startsWith('co_z')) {
      throw new Error(`[Kernel] Vibe ID must be co-id at runtime: ${vibeId}. This should have been resolved during seeding.`);
    }
    const vibeCoId = vibeId;
    
    // Load vibe CoValue first (without schema filter - read CoValue directly)
    // This allows us to extract schema co-id from headerMeta.$schema
    // Loading vibe from database
    
    const vibeStore = await this.dbEngine.execute({
      op: 'read',
      schema: null, // No schema filter - read CoValue directly
      key: vibeCoId
    });
    
    // Extract schema co-id from vibe's headerMeta.$schema using fromCoValue pattern
    const schemaStore = await this.dbEngine.execute({
      op: 'schema',
      fromCoValue: vibeCoId // ✅ Extracts headerMeta.$schema internally
    });
    const vibeSchemaCoId = schemaStore.value?.$id || vibeStore.value?.$schema;
    
    if (!vibeSchemaCoId) {
      throw new Error(`[Kernel] Failed to extract schema co-id from vibe ${vibeCoId}. Vibe must have $schema in headerMeta.`);
    }
    
    // Use the store we already have (vibeStore contains the vibe data)
    const store = vibeStore;
    
    // Store is already loaded by backend (operations API abstraction)
    let vibe = store.value;
    
    // Debug: Check what we got
    // Store value loaded
    
    if (!vibe || vibe.error) {
      // Debug: Try to see what's actually in the database
      console.error(`[Kernel] Vibe not found! Trying to debug...`);
      console.error(`[Kernel] Vibe co-id: ${vibeCoId}`);
      console.error(`[Kernel] Schema co-id: ${vibeSchemaCoId}`);
      
      // Try direct read to see what's returned
      try {
        const directStore = await this.dbEngine.execute({
          op: 'read',
          schema: null, // Read CoValue directly
          key: vibeCoId
        });
        const directValue = directStore.value;
        console.error(`[Kernel] Direct read() result:`, directValue ? 'FOUND' : 'NULL', directValue);
      } catch (err) {
        console.error(`[Kernel] Direct read() error:`, err);
      }
      
      throw new Error(`Vibe not found in database: ${vibeId} (co-id: ${vibeCoId})`);
    }
    
    // Convert CoJSON backend format (properties array) to plain object if needed
    if (vibe.properties && Array.isArray(vibe.properties)) {
      // CoJSON backend returns objects with properties array - convert to plain object
      const plainVibe = {};
      for (const prop of vibe.properties) {
        plainVibe[prop.key] = prop.value;
      }
      // Preserve metadata
      if (vibe.id) plainVibe.id = vibe.id;
      if (vibe.$schema) plainVibe.$schema = vibe.$schema; // Use $schema from headerMeta
      if (vibe.type) plainVibe.type = vibe.type;
      vibe = plainVibe;
      console.log(`[Kernel] Converted vibe from properties array format. Actor: ${vibe.actor}`);
    }
    
    // Validate vibe structure using schema (load from schemaStore we already have)
    const schema = schemaStore.value;
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, vibe, 'vibe');
    }
    
    // Actor ID should already be co-id (transformed during seeding)
    // If not co-id, it's a seeding error - fail fast
    let actorCoId = vibe.actor; // Should be "co_z..." (already transformed)
    
    if (!actorCoId) {
      throw new Error(`[MaiaOS] Vibe ${vibeId} (${vibeCoId}) does not have an 'actor' property. Vibe structure: ${JSON.stringify(Object.keys(vibe))}`);
    }
    
    if (!actorCoId.startsWith('co_z')) {
      throw new Error(`[Kernel] Actor ID must be co-id at runtime: ${actorCoId}. This should have been resolved during seeding.`);
    }
    
    // Extract actor schema co-id from actor's headerMeta.$schema using fromCoValue pattern
    const actorSchemaStore = await this.dbEngine.execute({
      op: 'schema',
      fromCoValue: actorCoId // ✅ Extracts headerMeta.$schema from actor instance
    });
    const actorSchemaCoId = actorSchemaStore.value?.$id;
    
    if (!actorSchemaCoId) {
      throw new Error(`[Kernel] Failed to extract schema co-id from actor ${actorCoId}. Actor must have $schema in headerMeta.`);
    }
    
    // Verify actor exists in database (using read operation with reactive store)
    const actorStore = await this.dbEngine.execute({
      op: 'read',
      schema: actorSchemaCoId,
      key: actorCoId
    });
    const actorExists = actorStore.value;
    if (!actorExists) {
      throw new Error(`[MaiaOS] Actor with co-id ${actorCoId} not found in database. The actor may not have been seeded correctly.`);
    }
    
    // Check if actors already exist for this vibe (reuse-based lifecycle)
    if (vibeKey) {
      const existingActors = this.actorEngine.getActorsForVibe(vibeKey);
      if (existingActors && existingActors.size > 0) {
        // Reuse existing actors - reattach to new container
        console.log(`[Kernel] Reusing existing actors for vibe: ${vibeKey}`);
        const rootActor = await this.actorEngine.reattachActorsForVibe(vibeKey, container);
        if (rootActor) {
          console.log(`✅ Vibe reattached: ${vibe.name}`);
          return { vibe, actor: rootActor };
        }
      }
    }
    
    // First time loading or no vibeKey - create actors normally
    // Load actor config via loadActor (which uses maia.db())
    const actorConfig = await this.actorEngine.loadActor(actorCoId);
    
    // Create root actor with vibeKey for tracking
    const actor = await this.actorEngine.createActor(actorConfig, container, vibeKey);
    
    console.log(`✅ Vibe loaded: ${vibe.name}`);
    
    return { vibe, actor };
  }
  
  /**
   * Debug helper to list coIdRegistry keys (for troubleshooting)
   * @private
   */
  async _debugCoIdRegistry() {
    try {
      // Get all keys from coIdRegistry store
      const transaction = this.dbEngine.backend.db.transaction(['coIdRegistry'], 'readonly');
      const store = transaction.objectStore('coIdRegistry');
      const request = store.getAllKeys();
      const keys = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return keys.filter(k => k && (k.includes('actor') || k.includes('agent')));
    } catch (error) {
      return [`Error: ${error.message}`];
    }
  }

  /**
   * Get actor by ID
   * @param {string} actorId - Actor ID
   * @returns {Object|null} Actor instance
   */
  getActor(actorId) {
    return this.actorEngine.getActor(actorId);
  }

  /**
   * Send message to actor
   * @param {string} actorId - Target actor ID
   * @param {Object} message - Message object
   */
  sendMessage(actorId, message) {
    this.actorEngine.sendMessage(actorId, message);
  }

  /**
   * Execute database operation (internal use + @db tool)
   * @param {Object} payload - Operation payload {op: 'query|create|update|delete|seed', ...}
   * @returns {Promise<any>} Operation result
   */
  async db(payload) {
    return await this.dbEngine.execute(payload);
  }
  
  /**
   * Expose engines for debugging
   */
  getEngines() {
    return {
      actorEngine: this.actorEngine,
      viewEngine: this.viewEngine,
      styleEngine: this.styleEngine,
      stateEngine: this.stateEngine,
      toolEngine: this.toolEngine,
      dbEngine: this.dbEngine,
      evaluator: this.evaluator,
      moduleRegistry: this.moduleRegistry
    };
  }
  
}
