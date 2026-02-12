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
import { resolve, resolveReactive } from '@MaiaOS/db';
import { ensureCoValueLoaded } from '@MaiaOS/db';
// SubscriptionEngine eliminated - all subscriptions handled via direct read() + ReactiveStore
import { DBEngine } from '@MaiaOS/script';
// Import validation helper
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
// Import all schemas for seeding
import * as schemata from '@MaiaOS/schemata';
// Import ValidationEngine for meta schema validation
import { ValidationEngine } from '@MaiaOS/schemata/validation.engine';
// Schema loading now uses resolve() from @MaiaOS/db if needed

// Pre-import default modules so they're bundled (for standalone bundle)
// This ensures db, core, ai, and sparks modules are included in the bundle
import * as dbModule from '@MaiaOS/script/modules/db.module.js';
import * as coreModule from '@MaiaOS/script/modules/core.module.js';
import * as aiModule from '@MaiaOS/script/modules/ai.module.js';
import * as sparksModule from '@MaiaOS/script/modules/sparks.module.js';

// Store pre-loaded modules for registry
const preloadedModules = {
  'db': dbModule,
  'core': coreModule,
  'ai': aiModule,
  'sparks': sparksModule,
};

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
    
    // Sync configuration - single source of truth
    this._syncDomain = null;
  }
  
  /**
   * Compatibility property for maia-city and other tools
   * Exposes node and account for CoJSON backend access
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
   * @param {string} [config.syncDomain] - Sync service domain (overrides env vars, single source of truth)
   * @param {'human' | 'agent'} [config.mode] - Operational mode (default: detect from env vars)
   * @returns {Promise<MaiaOS>} Booted OS instance
   * @throws {Error} If neither backend nor node+account is provided (or agent mode credentials missing)
   */
  static async boot(config = {}) {
    const os = new MaiaOS();
    
    // Booting MaiaOS
    
    // Detect operational mode from config or environment variables
    const mode = config.mode || 
                 (typeof process !== 'undefined' && process.env?.MAIA_MODE) ||
                 (typeof import.meta !== 'undefined' && import.meta.env?.MAIA_MODE) ||
                 (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAIA_MODE) ||
                 'human'; // Default to human mode
    
    // Store sync domain (single source of truth for sync configuration)
    // If provided, use it; otherwise will be determined from env vars when needed
    if (config.syncDomain) {
      os._syncDomain = config.syncDomain;
    }
    
    // Handle agent mode: automatically load/create account if node/account not provided
    if (mode === 'agent' && !config.node && !config.account && !config.backend) {
      // Import agent mode functions dynamically (to avoid circular dependencies)
      const { loadOrCreateAgentAccount } = await import('@MaiaOS/self');

      // Get credentials from environment variables
      // Note: Service-specific prefixes (SYNC_MAIA_*, CITY_MAIA_*) should be set by the service
      // This is a fallback for direct MaiaOS.boot() calls
      const accountID = (typeof process !== 'undefined' && process.env?.MAIA_AGENT_ACCOUNT_ID) ||
                        (typeof import.meta !== 'undefined' && import.meta.env?.MAIA_AGENT_ACCOUNT_ID) ||
                        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAIA_AGENT_ACCOUNT_ID);
      const agentSecret = (typeof process !== 'undefined' && process.env?.MAIA_AGENT_SECRET) ||
                          (typeof import.meta !== 'undefined' && import.meta.env?.MAIA_AGENT_SECRET) ||
                          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAIA_AGENT_SECRET);
      
      if (!accountID || !agentSecret) {
        throw new Error(
          'Agent mode requires MAIA_AGENT_ACCOUNT_ID and MAIA_AGENT_SECRET environment variables. ' +
          'For services, use service-specific prefixes: SYNC_MAIA_* for sync service, CITY_MAIA_* for maia-city. ' +
          'Run `bun agent:generate --service <service>` to generate credentials.'
        );
      }
      
      const agentResult = await loadOrCreateAgentAccount({
        accountID,
        agentSecret,
        syncDomain: config.syncDomain || null,
        createName: 'Maia Agent',
      });
      
      // Store node and account from agent mode
      os._node = agentResult.node;
      os._account = agentResult.account;
    } else {
      // Human mode or explicit node/account provided
      // Store node and account for CoJSON backend compatibility
      if (config.node && config.account) {
        os._node = config.node;
        os._account = config.account;
      }
    }
    
    // Initialize database (requires CoJSON backend via node+account or pre-initialized backend)
    const backend = await MaiaOS._initializeDatabase(os, config);
    
    // OPTIMIZATION: Start loading account.os in background (non-blocking)
    // account.os is NOT required for account loading - it's only needed for schema resolution
    // Schema resolution can happen progressively as account.os becomes available
    // This allows MaiaOS to boot immediately without waiting 5+ seconds for account.os to sync
    if (backend && typeof backend.ensureAccountOsReady === 'function') {
      // Start loading account.os in background (non-blocking)
      // 15s timeout for slow sync (e.g. first load to sync.next.maia.city)
      backend.ensureAccountOsReady({ timeoutMs: 15000 }).then(accountOsReady => {
        if (!accountOsReady) {
          console.warn('[MaiaOS.boot] account.os not ready yet - schema resolution will work once sync completes');
        }
      }).catch(err => {
        console.warn('[MaiaOS.boot] account.os loading (non-blocking):', err.message);
      });
      // Don't await - let it load in background while we continue booting
    }
    
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
    // Create minimal evaluator for DBEngine (expression evaluation in updates)
    const evaluator = new MaiaScriptEvaluator();

    // If backend is provided, use it
    if (config.backend) {
      os.dbEngine = new DBEngine(config.backend, { evaluator });
      return config.backend;
    }

    // If node and account are provided, use CoJSON backend
    if (config.node && config.account) {
      const { CoJSONBackend } = await import('@MaiaOS/db');
      const backend = new CoJSONBackend(config.node, config.account, { systemSpark: '@maia' });
      os.dbEngine = new DBEngine(backend, { evaluator });
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
    // Use registry default data if available
    // Note: data.todos is deprecated - items are automatically indexed into account.os.{schemaCoId}
    const defaultData = config.registry?.data || {};
    const seedData = defaultData;
    
    const seedResult = await os.dbEngine.execute({
      op: 'seed',
      configs: configsWithTools,
      schemas: schemas,
      data: seedData
    });
    if (!seedResult.ok) {
      const msgs = seedResult.errors?.map((e) => e.message).join('; ') || 'Seed failed';
      throw new Error(`[MaiaOS] Seed failed: ${msgs}`);
    }
    
    // Database seeded successfully
    
    // Set schema resolver on validation helper singleton for engines to use
    // Pass dbEngine to use operations API (preferred over resolver function)
    const { setSchemaResolver } = await import('@MaiaOS/schemata/validation.helper');
    setSchemaResolver({ dbEngine: os.dbEngine }); // Pass dbEngine to use operations API
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
    
    // SubscriptionEngine eliminated - all subscriptions handled via direct read() + ReactiveStore
    
    // Pass database engine to engines (for internal config loading)
    os.actorEngine.dbEngine = os.dbEngine;
    os.viewEngine.dbEngine = os.dbEngine;
    os.styleEngine.dbEngine = os.dbEngine;
    os.stateEngine.dbEngine = os.dbEngine;
    
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
    // Load modules (default: db, core, sparks)
    const modules = config.modules || ['db', 'core', 'sparks'];
    
    for (const moduleName of modules) {
      try {
        // Check if module is pre-loaded (for bundled standalone kernel)
        if (preloadedModules[moduleName]) {
          const module = preloadedModules[moduleName];
          // Register the pre-loaded module directly
          if (module.default && typeof module.default.register === 'function') {
            await module.default.register(os.moduleRegistry);
          } else if (typeof module.register === 'function') {
            await module.register(os.moduleRegistry);
          }
        } else {
          // Fallback to dynamic import (for development)
          await os.moduleRegistry.loadModule(moduleName);
        }
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
    // Use universal API directly - no wrapper needed
    let actorConfig;
    if (typeof actorPath === 'object' && actorPath !== null) {
      // Already have config object - just use it
      actorConfig = actorPath;
    } else if (typeof actorPath === 'string' && actorPath.startsWith('co_z')) {
      // Load actor config using read() directly
      const actorSchemaCoId = await resolve(this.actorEngine.dbEngine.backend, { fromCoValue: actorPath }, { returnType: 'coId' });
      const store = await this.actorEngine.dbEngine.execute({ op: 'read', schema: actorSchemaCoId, key: actorPath });
      actorConfig = store.value;
    } else {
      throw new Error(`[MaiaOS] createActor expects co-id (co_z...) or config object, got: ${typeof actorPath}`);
    }
    const actor = await this.actorEngine.createActor(actorConfig, container);
    return actor;
  }

  /**
   * Load a vibe by key or co-id from account/database (no arbitrary URL loading)
   * @param {string} vibeKeyOrCoId - Vibe key (e.g., "todos") or co-id (co_z...) to lookup from account
   * @param {HTMLElement} container - Container element
   * @param {string} [spark='@maia'] - Spark name when using key lookup
   * @returns {Promise<{vibe: Object, actor: Object}>} Vibe metadata and actor instance
   */
  async loadVibe(vibeKeyOrCoId, container, spark = '@maia') {
    return await this.loadVibeFromAccount(vibeKeyOrCoId, container, spark);
  }

  /**
   * Load a vibe from account.sparks[spark].vibes or directly by co-id
   * Supports: (1) vibe key (e.g., "todos") - lookup via spark.vibes map, (2) co-id (co_z...) - direct load from database
   * SECURITY: No arbitrary URL loading - vibes load only from CoJSON database (account-scoped)
   * @param {string} vibeKeyOrCoId - Vibe key in spark's vibes (e.g., "todos") or vibe co-id (co_z...)
   * @param {HTMLElement} container - Container element
   * @param {string} [spark='@maia'] - Spark name (used only when vibeKeyOrCoId is a key, not a co-id)
   * @returns {Promise<{vibe: Object, actor: Object}>} Vibe metadata and actor instance
   */
  async loadVibeFromAccount(vibeKeyOrCoId, container, spark = '@maia') {
    if (!this.dbEngine || !this._account) {
      throw new Error('[Kernel] Cannot load vibe from account - dbEngine or account not available');
    }

    // Co-id: load directly from database (skip spark.vibes lookup)
    if (typeof vibeKeyOrCoId === 'string' && vibeKeyOrCoId.startsWith('co_z')) {
      return await this.loadVibeFromDatabase(vibeKeyOrCoId, container, null);
    }

    const account = this._account;

    // Step 1: Read account CoMap
    const accountStore = await this.dbEngine.execute({
      op: 'read',
      schema: '@account',
      key: account.id
    });

    const accountData = accountStore.value;
    if (!accountData) {
      throw new Error('[Kernel] Failed to read account CoMap');
    }

    // Step 2: Get account.sparks CoMap co-id
    const sparksId = accountData.sparks;
    if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_')) {
      throw new Error(`[Kernel] account.sparks not found. Ensure schemaMigration has run. Account data: ${JSON.stringify({ id: accountData.id, hasSparks: !!accountData.sparks })}`);
    }

    // Step 3: Read account.sparks CoMap
    const sparksStore = await this.dbEngine.execute({
      op: 'read',
      schema: sparksId,
      key: sparksId
    });

    const sparksData = sparksStore.value;
    if (!sparksData || sparksData.error) {
      throw new Error(`[Kernel] account.sparks not available: ${sparksData?.error || 'Unknown error'}`);
    }

    // Step 4: Get spark CoMap co-id from sparks[spark]
    const sparkCoId = sparksData[spark];
    if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_')) {
      const availableSparks = Object.keys(sparksData).filter(k => k !== 'id' && k !== '$schema' && k !== 'type' && typeof sparksData[k] === 'string' && sparksData[k].startsWith('co_'));
      throw new Error(`[Kernel] Spark "${spark}" not found in account.sparks. Available: ${availableSparks.join(', ') || 'none'}`);
    }

    // Step 5: Read spark CoMap to get spark.vibes (by co-id)
    const sparkStore = await this.dbEngine.execute({
      op: 'read',
      schema: null,
      key: sparkCoId
    });

    const sparkData = sparkStore.value;
    if (!sparkData || sparkData.error) {
      throw new Error(`[Kernel] Spark "${spark}" not available: ${sparkData?.error || 'Unknown error'}`);
    }

    const vibesId = sparkData.vibes;
    if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_')) {
      throw new Error(`[Kernel] Spark "${spark}" has no vibes registry. Ensure seeding has run.`);
    }

    // Step 6: Read spark.vibes CoMap
    const vibesStore = await this.dbEngine.execute({
      op: 'read',
      schema: vibesId,
      key: vibesId
    });

    const vibesData = vibesStore.value;
    if (!vibesData || vibesData.error) {
      throw new Error(`[Kernel] Spark "${spark}" vibes not available: ${vibesData?.error || 'Unknown error'}`);
    }

    const vibeCoId = vibesData[vibeKeyOrCoId];
    if (!vibeCoId || typeof vibeCoId !== 'string' || !vibeCoId.startsWith('co_')) {
      const availableVibes = Object.keys(vibesData).filter(k => k !== 'id' && k !== '$schema' && k !== 'type' && typeof vibesData[k] === 'string' && vibesData[k].startsWith('co_'));
      throw new Error(`[Kernel] Vibe '${vibeKeyOrCoId}' not found in ${spark}.vibes. Available: ${availableVibes.join(', ') || 'none'}`);
    }

    // STRICT: Require explicit browser runtime in spark.os.runtimes (no fallback)
    const osId = sparkData.os;
    if (osId && typeof osId === 'string' && osId.startsWith('co_')) {
      const osStore = await this.dbEngine.execute({ op: 'read', schema: null, key: osId });
      const osContent = osStore?.value;
      const runtimesId = osContent?.runtimes;
      if (runtimesId && typeof runtimesId === 'string' && runtimesId.startsWith('co_')) {
        const runtimesStore = await this.dbEngine.execute({ op: 'read', schema: null, key: runtimesId });
        const runtimesData = runtimesStore?.value;
        const assignmentsColistId = runtimesData?.[vibeCoId] ?? runtimesData?.get?.(vibeCoId);
        if (assignmentsColistId) {
          const colistStore = await this.dbEngine.execute({ op: 'read', schema: null, key: assignmentsColistId });
          const colistData = colistStore?.value;
          const items = colistData?.items ?? [];
          const itemIds = Array.isArray(items) ? items : [];
          let hasBrowser = false;
          for (const itemCoId of itemIds) {
            if (typeof itemCoId !== 'string' || !itemCoId.startsWith('co_')) continue;
            const itemStore = await this.dbEngine.execute({ op: 'read', schema: null, key: itemCoId });
            const itemData = itemStore?.value;
            if (itemData?.browser) { hasBrowser = true; break; }
          }
          if (!hasBrowser) {
            throw new Error(`[Kernel] Vibe '${vibeKeyOrCoId}' has no browser runtime in spark.os.runtimes. Access denied.`);
          }
        } else {
          throw new Error(`[Kernel] Vibe '${vibeKeyOrCoId}' has no runtimes entry in spark.os.runtimes. Access denied.`);
        }
      } else {
        throw new Error(`[Kernel] Spark "${spark}" has no runtimes registry. Vibe loading requires spark.os.runtimes.`);
      }
    } else {
      throw new Error(`[Kernel] Spark "${spark}" has no os. Vibe loading requires spark.os.runtimes.`);
    }

    return await this.loadVibeFromDatabase(vibeCoId, container, vibeKeyOrCoId);
  }

  /**
   * Load a vibe from database (maia.db)
   * @param {string} vibeId - Vibe ID (co-id or human-readable like "@maia/vibe/todos")
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
    
    // UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
    // Returns ReactiveStore that updates when schema becomes available
    const actorSchemaStore = resolveReactive(this.dbEngine.backend, { fromCoValue: actorCoId }, { returnType: 'coId' });
    
    // Subscribe and wait for schema to resolve (reactive - uses subscriptions, not blocking waits)
    let unsubscribe; // Declare before Promise to avoid temporal dead zone
    const actorSchemaCoId = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (unsubscribe) unsubscribe();
        reject(new Error(`[Kernel] Timeout waiting for actor schema to resolve for ${actorCoId} after 10000ms`));
      }, 10000);
      
      unsubscribe = actorSchemaStore.subscribe((state) => {
        if (state.loading) {
          return; // Still loading
        }
        
        clearTimeout(timeout);
        if (unsubscribe) unsubscribe();
        
        if (state.error || !state.schemaCoId) {
          reject(new Error(`[Kernel] Failed to extract schema co-id from actor ${actorCoId}: ${state.error || 'Schema not found'}`));
        } else {
          resolve(state.schemaCoId);
        }
      });
    });
    
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
    
    // Destroy any existing actors for this vibe (destroy-on-switch lifecycle)
    // Ensures cleanup of subscriptions and prevents memory leaks
    if (vibeKey) {
      this.actorEngine.destroyActorsForVibe(vibeKey);
    }
    
    // Create actors
    // Use universal API directly - actorSchemaCoId already resolved above
    // Reuse actorStore that was already loaded for verification
    const actorConfig = actorStore.value;
    
    // Create root actor with vibeKey for tracking
    const actor = await this.actorEngine.createActor(actorConfig, container, vibeKey);
    
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
   * @returns {Promise<any>} Operation result; for write ops: throws on error, returns data on success (backward compat for state machines)
   */
  async db(payload) {
    const result = await this.dbEngine.execute(payload);
    const WRITE_OPS = new Set(['create', 'update', 'delete', 'append', 'push', 'seed', 'addSparkMember', 'removeSparkMember']);
    if (result && result.ok === false && WRITE_OPS.has(payload?.op)) {
      const msgs = result.errors?.map((e) => e.message).join('; ') || 'Operation failed';
      const err = new Error(`[db] ${payload.op} failed: ${msgs}`);
      err.errors = result.errors;
      throw err;
    }
    if (result && result.ok === true && typeof result.data !== 'undefined') {
      return result.data;
    }
    return result;
  }
  
  /**
   * Get sync domain (single source of truth)
   * Returns the sync domain configured during boot, or null if not set
   * @returns {string|null} Sync domain or null
   */
  getSyncDomain() {
    return this._syncDomain;
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
