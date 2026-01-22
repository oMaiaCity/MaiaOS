/**
 * Drag-Drop Module - @dragdrop/* tools
 * Provides drag-and-drop functionality with configuration
 */

import { getToolEngine, registerToolsFromRegistry, registerSingleToolFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class DragDropModule {
  /**
   * Drag-drop configuration
   * Provides rules and settings for drag-drop behavior
   */
  static config = {
    // Events that should auto-preventDefault
    autoPreventDefaultEvents: ['dragover', 'drop', 'dragenter'],
    
    // Visual feedback classes (can be customized)
    visualFeedback: {
      draggableClass: 'cursor-move',
      draggingClass: 'opacity-50',
      dragOverClass: 'bg-blue-50 border-blue-300'
    },
    
    // Allowed drag effects
    dragEffects: {
      allowed: ['move', 'copy', 'link'],
      default: 'move'
    },
    
    // Allowed draggable tags
    allowedDraggableTags: [
      'div', 'section', 'article', 'li', 'span', 'button'
    ],
    
    // Allowed dropzone tags
    allowedDropzoneTags: [
      'div', 'section', 'article', 'ul', 'ol'
    ]
  };

  /**
   * Register drag-drop tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   */
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'DragDropModule');
    
    const toolNames = [
      'start',
      'end',
      'drop',
      'dragEnter',
      'dragLeave'
    ];
    
    console.log(`[DragDropModule] Registering ${toolNames.length + 1} tools...`);
    
    // Register @context/update first (critical for input handling)
    await registerSingleToolFromRegistry(toolEngine, 'context/update', '@context/update');
    
    // Register drag-drop tools
    await registerToolsFromRegistry(registry, toolEngine, 'dragdrop', toolNames, '@dragdrop');
    
    // Register module with config (even if some tools failed)
    registerModuleConfig(registry, 'dragdrop', DragDropModule, {
      version: '1.0.0',
      description: 'Drag-and-drop tools and configuration',
      namespace: '@dragdrop',
      tools: toolNames.map(t => `@dragdrop/${t}`).concat(['@context/update'])
    });
    
    console.log('[DragDropModule] Registration complete');
  }

  /**
   * Query method for module configuration
   * @param {string} query - Query string
   * @returns {any}
   */
  static query(query) {
    // Return whole config if query is 'config'
    if (query === 'config') {
      return DragDropModule.config;
    }
    
    // Check if query is a key in config object
    if (Object.prototype.hasOwnProperty.call(DragDropModule.config, query)) {
      return DragDropModule.config[query];
    }
    
    return null;
  }

  /**
   * Check if an event should auto-preventDefault
   * @param {string} eventType - Event type (e.g., 'dragover', 'drop')
   * @returns {boolean}
   */
  static shouldPreventDefault(eventType) {
    return DragDropModule.config.autoPreventDefaultEvents.includes(eventType);
  }
}

/**
 * Register function for dynamic loading
 * @param {ModuleRegistry} registry - Module registry instance
 */
export async function register(registry) {
  await DragDropModule.register(registry);
}
