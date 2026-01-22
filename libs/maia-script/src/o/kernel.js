/**
 * MaiaScript Kernel - v0.4
 * 
 * Single entry point for the MaiaScript Operating System
 * Bundles all engines and exposes unified API
 * Module-based architecture with dynamic loading
 * 
 * Usage:
 *   import { MaiaOS } from './o/kernel.js';
 *   const os = await MaiaOS.boot(config);
 */

// Import all engines
import { ActorEngine } from './engines/actor-engine/actor.engine.js';
import { ViewEngine } from './engines/view-engine/view.engine.js';
import { StyleEngine } from './engines/style-engine/style.engine.js';
import { StateEngine } from './engines/state-engine/state.engine.js';
import { MaiaScriptEvaluator } from './engines/MaiaScriptEvaluator.js';
import { ModuleRegistry } from './engines/ModuleRegistry.js';
import { ToolEngine } from './engines/tool-engine/tool.engine.js';
import { SubscriptionEngine } from './engines/subscription-engine/subscription.engine.js';
// Import database operation engine
import { DBEngine } from './engines/db-engine/db.engine.js';
import { IndexedDBBackend } from './engines/db-engine/backend/indexeddb.js';
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
    console.log('📦 Kernel: Module-based architecture');
    console.log('🤖 State Machines: AI-compatible actor coordination');
    console.log('📨 Message Passing: Actor-to-actor communication');
    console.log('🔧 Tools: Dynamic modular loading');
    console.log('💾 Database: Unified operation engine (maia.db)');
    
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
    
    console.log(`✅ Loaded ${os.moduleRegistry.listModules().length} modules`);
    console.log(`✅ Registered ${os.toolEngine.tools.size} tools`);
    console.log('✅ MaiaOS booted successfully');
    
    return os;
  }

  /**
   * Initialize database backend and engine
   * @param {MaiaOS} os - OS instance
   * @returns {Promise<IndexedDBBackend>} Initialized backend
   */
  static async _initializeDatabase(os) {
    console.log('📦 Initializing database engine...');
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
    console.log('🔍 Validating schemas against meta schema...');
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
    console.log('✅ All schemas validated against meta schema');
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
    const { getAllToolDefinitions } = await import('./tools/index.js');
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
    console.log(`📦 Loading ${modules.length} modules...`);
    
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
    console.log(`📦 Loading vibe from ${vibePath}...`);
    
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
    
    console.log(`✨ Vibe: "${vibe.name}"`);
    
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
    console.log(`📦 Loading vibe from database: "${vibeId}"...`);
    
    // Load vibe manifest from database using new ID format
    const vibe = await this.dbEngine.execute({
      op: 'query',
      schema: '@schema/vibe',
      key: vibeId
    });
    
    if (!vibe) {
      throw new Error(`Vibe not found in database: ${vibeId}`);
    }
    
    // Validate vibe structure using schema (load from IndexedDB on-the-fly)
    const schema = await loadSchemaFromDB(this.dbEngine, 'vibe');
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, vibe, 'vibe');
    }
    
    console.log(`✨ Vibe: "${vibe.name}"`);
    
    // Resolve actor ID (can be human-readable like @actor/agent or co-id)
    let actorCoId = vibe.actor; // e.g., "@actor/agent" or "co_z..."
    
    // If it's a human-readable ID, resolve it to a co-id
    if (!actorCoId.startsWith('co_z')) {
      if (!this.dbEngine) {
        throw new Error(`[MaiaOS] Cannot resolve human-readable actor ID ${actorCoId} - database engine not available`);
      }
      
      // Resolve via database (handles @actor/name format)
      const resolvedActor = await this.dbEngine.get('@schema/actor', actorCoId);
      if (resolvedActor && resolvedActor.$id && resolvedActor.$id.startsWith('co_z')) {
        actorCoId = resolvedActor.$id;
      } else {
        throw new Error(`[MaiaOS] Could not resolve actor ID ${vibe.actor} to a co-id`);
      }
    }
    
    // Load actor config via loadActor (which uses maia.db())
    const actorConfig = await this.actorEngine.loadActor(actorCoId);
    
    // Create root actor
    const actor = await this.actorEngine.createActor(actorConfig, container);
    
    console.log(`✅ Vibe loaded: ${vibe.name}`);
    
    return { vibe, actor };
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

// Re-export engines for advanced use cases
export {
  ActorEngine,
  ViewEngine,
  StyleEngine,
  StateEngine,
  MaiaScriptEvaluator,
  ModuleRegistry,
  ToolEngine
};
