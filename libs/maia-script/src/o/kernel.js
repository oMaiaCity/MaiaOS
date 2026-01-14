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
import { StateEngine } from './engines/StateEngine.js';
import { MaiaScriptEvaluator } from './engines/MaiaScriptEvaluator.js';
import { ModuleRegistry } from './engines/ModuleRegistry.js';
import { ToolEngine } from './engines/tool-engine/tool.engine.js';

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
    this.actors = new Map();
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
    
    // Initialize module registry
    os.moduleRegistry = new ModuleRegistry();
    
    // Initialize engines
    os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry);
    os.toolEngine = new ToolEngine(os.moduleRegistry);
    
    // Store toolEngine in registry for module access
    os.moduleRegistry._toolEngine = os.toolEngine;
    
    // Set tools path (default: ../../o/tools relative to HTML file location)
    const toolsPath = config.toolsPath || '../../o/tools';
    os.toolEngine.setToolsPath(toolsPath);
    
    os.stateEngine = new StateEngine(os.toolEngine, os.evaluator);
    os.styleEngine = new StyleEngine();
    os.styleEngine.clearCache(); // Clear cache on boot for development
    os.viewEngine = new ViewEngine(os.evaluator, null, os.moduleRegistry);
    os.actorEngine = new ActorEngine(
      os.styleEngine,
      os.viewEngine,
      os.moduleRegistry,
      os.toolEngine,
      os.stateEngine
    );
    
    // Set actorEngine reference in viewEngine (circular dependency)
    os.viewEngine.actorEngine = os.actorEngine;
    
    // Load modules (default: core, mutation, dragdrop, query, and interface)
    const modules = config.modules || ['core', 'mutation', 'dragdrop', 'query', 'interface'];
    console.log(`📦 Loading ${modules.length} modules...`);
    
    for (const moduleName of modules) {
      try {
        await os.moduleRegistry.loadModule(moduleName);
      } catch (error) {
        console.error(`Failed to load module "${moduleName}":`, error);
      }
    }
    
    console.log(`✅ Loaded ${os.moduleRegistry.listModules().length} modules`);
    console.log(`✅ Registered ${os.toolEngine.tools.size} tools`);
    console.log('✅ MaiaOS booted successfully');
    
    return os;
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
    this.actors.set(actor.id, actor);
    return actor;
  }

  /**
   * Load a vibe (app manifest) and create its root actor
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
    
    // Validate vibe structure
    if (vibe.$type !== 'vibe') {
      throw new Error(`Invalid vibe manifest: $type must be "vibe"`);
    }
    
    if (!vibe.actor) {
      throw new Error(`Vibe manifest missing "actor" field`);
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
   * Get actor by ID
   * @param {string} actorId - Actor ID
   * @returns {Object|null} Actor instance
   */
  getActor(actorId) {
    return this.actors.get(actorId);
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
   * Expose engines for debugging
   */
  getEngines() {
    return {
      actorEngine: this.actorEngine,
      viewEngine: this.viewEngine,
      styleEngine: this.styleEngine,
      stateEngine: this.stateEngine,
      toolEngine: this.toolEngine,
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
