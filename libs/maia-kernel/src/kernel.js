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
import { IndexedDBBackend } from '@MaiaOS/script';
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
  }

  /**
   * Boot the operating system
   * @param {Object} config - Boot configuration
   * @returns {Promise<MaiaOS>} Booted OS instance
   */
  static async boot(config = {}) {
    const os = new MaiaOS();
    
    console.log('🚀 Booting MaiaOS v0.4...');
    
    // Initialize database
    const backend = await MaiaOS._initializeDatabase(os);
    
    // Seed database if registry provided
    if (config.registry) {
      await MaiaOS._seedDatabase(os, backend, config);
    }
    
    // Initialize engines
    MaiaOS._initializeEngines(os, config);
    
    // Load modules
    await MaiaOS._loadModules(os, config);
    
    console.log(`✅ MaiaOS booted: ${os.moduleRegistry.listModules().length} modules, ${os.toolEngine.tools.size} tools`);
    
    return os;
  }

  /**
   * Initialize database backend and engine
   * @param {MaiaOS} os - OS instance
   * @returns {Promise<IndexedDBBackend>} Initialized backend
   */
  static async _initializeDatabase(os) {
    const backend = new IndexedDBBackend();
    await backend.init();
    os.dbEngine = new DBEngine(backend);
    return backend;
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
   * @param {IndexedDBBackend} backend - Database backend
   * @param {Object} config - Boot configuration
   */
  static async _seedDatabase(os, backend, config) {
    console.log('🌱 Seeding database...');
    
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
    await os.dbEngine.execute({
      op: 'seed',
      configs: configsWithTools,
      schemas: schemas,
      data: { todos: [] } // Initial empty collections
    });
    
    console.log('✅ Database seeded successfully');
    
    // Set schema resolver on validation helper singleton for engines to use
    const { setSchemaResolver } = await import('@MaiaOS/schemata/validation.helper');
    setSchemaResolver(async (schemaKey) => {
      try {
        return await backend.getSchema(schemaKey);
      } catch (error) {
        console.warn(`[MaiaOS] Failed to resolve schema ${schemaKey}:`, error);
        return null;
      }
    });
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
    os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry);
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
    
    // Validate vibe structure using schema (load from IndexedDB on-the-fly)
    const schema = await loadSchemaFromDB(this.dbEngine, 'vibe');
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, vibe, 'vibe');
    }
    
    // Resolve actor path relative to vibe location
    const vibeDir = vibePath.substring(0, vibePath.lastIndexOf('/'));
    const actorPath = `${vibeDir}/${vibe.actor}`;
    
    // Create root actor
    const actor = await this.createActor(actorPath, container);
    
    console.log(`✅ Vibe loaded: ${vibe.name}`);
    
    return { vibe, actor };
  }

  /**
   * Load a vibe from database (maia.db)
   * @param {string} vibeId - Vibe ID in new format (e.g., "@vibe/todos", "@vibe/notes")
   * @param {HTMLElement} container - Container element
   * @returns {Promise<{vibe: Object, actor: Object}>} Vibe metadata and actor instance
   */
  async loadVibeFromDatabase(vibeId, container) {
    // Get vibe schema co-id
    const vibeSchemaCoId = await this.dbEngine.getSchemaCoId('vibe');
    if (!vibeSchemaCoId) {
      throw new Error('[Kernel] Failed to resolve vibe schema co-id');
    }
    
    // Resolve human-readable vibeId to co-id if needed
    let vibeCoId = vibeId;
    if (!vibeId.startsWith('co_z')) {
      // Define alternative formats to try
      const alternatives = [
        `@schema/vibe:${vibeId.replace('@vibe/', '')}`, // @schema/vibe:todos
        vibeId.replace('@vibe/', 'vibe/'), // vibe/todos
        `@vibe/${vibeId.replace('@vibe/', '')}`, // @vibe/todos (explicit)
      ];
      
      // Try to resolve human-readable ID (e.g., @vibe/todos) to co-id
      vibeCoId = await this.dbEngine.resolveCoId(vibeId);
      if (!vibeCoId) {
        // Try alternative formats that might be stored in registry
        for (const alt of alternatives) {
          vibeCoId = await this.dbEngine.resolveCoId(alt);
          if (vibeCoId) {
            console.log(`[Kernel] Resolved vibe ID '${vibeId}' via alternative format '${alt}' to co-id: ${vibeCoId}`);
            break;
          }
        }
      } else {
        console.log(`[Kernel] Resolved vibe ID '${vibeId}' directly to co-id: ${vibeCoId}`);
      }
      if (!vibeCoId) {
        // Debug: Try to see what's actually in the registry
        console.error(`[Kernel] Failed to resolve vibe ID '${vibeId}'. Tried: ${vibeId}, ${alternatives.join(', ')}`);
        throw new Error(`[Kernel] Failed to resolve vibe ID '${vibeId}' to co-id. Make sure the vibe was seeded correctly. The database may need to be cleared and re-seeded.`);
      }
    }
    
    // Load vibe manifest from database using co-id (using read operation with reactive store)
    console.log(`[Kernel] Loading vibe from database: schema=${vibeSchemaCoId}, key=${vibeCoId}`);
    
    const store = await this.dbEngine.execute({
      op: 'read',
      schema: vibeSchemaCoId,
      key: vibeCoId
    });
    
    // Get current value from reactive store
    const vibe = store.value;
    
    // Debug: Check what we got
    console.log(`[Kernel] Store value after read:`, vibe ? 'FOUND' : 'NULL', vibe ? { $id: vibe.$id, name: vibe.name } : null);
    
    if (!vibe) {
      // Debug: Try to see what's actually in the database
      console.error(`[Kernel] Vibe not found! Trying to debug...`);
      console.error(`[Kernel] Resolved co-id: ${vibeCoId}`);
      console.error(`[Kernel] Schema co-id: ${vibeSchemaCoId}`);
      
      // Try direct read to see what's returned
      try {
        const directStore = await this.dbEngine.execute({
          op: 'read',
          schema: vibeSchemaCoId,
          key: vibeCoId
        });
        const directValue = directStore.value;
        console.error(`[Kernel] Direct read() result:`, directValue ? 'FOUND' : 'NULL', directValue);
      } catch (err) {
        console.error(`[Kernel] Direct read() error:`, err);
      }
      
      // Try to list all vibes in the configs store
      try {
        const allVibes = await this.dbEngine.execute({
          op: 'read',
          schema: vibeSchemaCoId
        });
        console.error(`[Kernel] All vibes in store:`, allVibes.value);
      } catch (err) {
        console.error(`[Kernel] Error listing vibes:`, err);
      }
      
      throw new Error(`Vibe not found in database: ${vibeId} (resolved to ${vibeCoId})`);
    }
    
    // Validate vibe structure using schema (load from IndexedDB on-the-fly)
    const schema = await loadSchemaFromDB(this.dbEngine, 'vibe');
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, vibe, 'vibe');
    }
    
    // Resolve actor ID (can be human-readable like @actor/agent or co-id)
    let actorCoId = vibe.actor; // e.g., "@actor/agent" or "co_z..."
    
    // If it's already a co-id, verify it exists first
    // If it doesn't exist, try resolving from registry (handles mismatches from transformation)
    if (actorCoId && actorCoId.startsWith('co_z')) {
      // Verify the co-id exists in database (using read operation with reactive store)
      const actorStore = await this.dbEngine.execute({
        op: 'read',
        schema: await this.dbEngine.getSchemaCoId('actor'),
        key: actorCoId
      });
      const actorExists = actorStore.value;
      
      if (!actorExists) {
        // Co-id from vibe doesn't exist - try resolving @actor/agent from registry instead
        console.warn(`[Kernel] Actor co-id ${actorCoId.substring(0, 20)}... from vibe not found. Trying to resolve @actor/agent from registry...`);
        const resolvedFromRegistry = await this.dbEngine.resolveCoId('@actor/agent');
        if (resolvedFromRegistry && resolvedFromRegistry.startsWith('co_z')) {
          // Verify the resolved co-id exists (using read operation with reactive store)
          const resolvedStore = await this.dbEngine.execute({
            op: 'read',
            schema: await this.dbEngine.getSchemaCoId('actor'),
            key: resolvedFromRegistry
          });
          const resolvedExists = resolvedStore.value;
          if (resolvedExists) {
            actorCoId = resolvedFromRegistry;
            console.log(`[Kernel] Resolved @actor/agent from registry to co-id: ${actorCoId}`);
          } else {
            throw new Error(`[MaiaOS] Actor co-id ${actorCoId.substring(0, 20)}... from vibe not found, and resolved @actor/agent (${resolvedFromRegistry.substring(0, 20)}...) also not found. The actor may not have been seeded correctly.`);
          }
        } else {
          throw new Error(`[MaiaOS] Actor co-id ${actorCoId.substring(0, 20)}... from vibe not found, and @actor/agent not found in registry. The actor may not have been seeded correctly.`);
        }
      } else {
        console.log(`[Kernel] Using actor co-id ${actorCoId.substring(0, 20)}... from vibe`);
      }
    } else if (!actorCoId.startsWith('co_z')) {
      // Human-readable ID - resolve from registry
      if (!this.dbEngine) {
        throw new Error(`[MaiaOS] Cannot resolve human-readable actor ID ${actorCoId} - database engine not available`);
      }
      
      const originalActorId = actorCoId;
      
      // Resolve via coIdRegistry (handles @actor/name format)
      actorCoId = await this.dbEngine.resolveCoId(actorCoId);
      if (!actorCoId || !actorCoId.startsWith('co_z')) {
        // Try alternative formats
        const alternatives = [
          `@schema/actor:${originalActorId.replace('@actor/', '')}`,
          originalActorId.replace('@actor/', 'actor/'),
        ];
        for (const alt of alternatives) {
          const resolved = await this.dbEngine.resolveCoId(alt);
          if (resolved && resolved.startsWith('co_z')) {
            actorCoId = resolved;
            console.log(`[Kernel] Resolved actor ID '${originalActorId}' via alternative format '${alt}' to co-id: ${actorCoId}`);
            break;
          }
        }
        if (!actorCoId || !actorCoId.startsWith('co_z')) {
          console.error(`[Kernel] Failed to resolve actor ID '${originalActorId}'. Available keys in coIdRegistry:`, await this._debugCoIdRegistry());
          throw new Error(`[MaiaOS] Could not resolve actor ID ${originalActorId} to a co-id. Make sure the actor was seeded correctly.`);
        }
      } else {
        console.log(`[Kernel] Resolved actor ID '${originalActorId}' directly to co-id: ${actorCoId}`);
      }
    }
    
    // Debug: Verify actor exists in database before loading (using read operation with reactive store)
    const actorStore = await this.dbEngine.execute({
      op: 'read',
      schema: await this.dbEngine.getSchemaCoId('actor'),
      key: actorCoId
    });
    const actorExists = actorStore.value;
    if (!actorExists) {
      console.error(`[Kernel] Actor co-id ${actorCoId} not found in database. Checking configs store...`);
      // Try direct read to see what's in the store
      const directStore = await this.dbEngine.execute({
        op: 'read',
        schema: await this.dbEngine.getSchemaCoId('actor'),
        key: actorCoId
      });
      const directValue = directStore.value;
      console.error(`[Kernel] Direct read result:`, directValue);
      
      // Debug: Check what actor co-ids ARE in the configs store
      try {
        const actorSchemaCoId = await this.dbEngine.getSchemaCoId('actor');
        const configsTransaction = this.dbEngine.backend.db.transaction(['configs'], 'readonly');
        const configsStore = configsTransaction.objectStore('configs');
        const allConfigsRequest = configsStore.getAll();
        const allConfigs = await this.dbEngine.backend._promisifyRequest(allConfigsRequest);
        const actorConfigs = (allConfigs || []).filter(item => 
          item.value && item.value.$schema && 
          item.value.$schema === actorSchemaCoId
        );
        console.error(`[Kernel] Available actor configs in store:`, actorConfigs.map(c => ({
          key: c.key,
          $id: c.value?.$id,
          role: c.value?.role
        })));
      } catch (err) {
        console.error(`[Kernel] Could not list configs:`, err);
      }
      
      throw new Error(`[MaiaOS] Actor with co-id ${actorCoId} not found in database. The actor may not have been seeded correctly.`);
    }
    
    // Load actor config via loadActor (which uses maia.db())
    const actorConfig = await this.actorEngine.loadActor(actorCoId);
    
    // Create root actor
    const actor = await this.actorEngine.createActor(actorConfig, container);
    
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
