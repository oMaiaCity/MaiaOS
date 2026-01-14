/**
 * Drag-Drop Module - @dragdrop/* tools
 * Provides drag-and-drop functionality with configuration
 */

export class DragDropModule {
  /**
   * Drag-drop configuration
   * Provides rules and settings for drag-drop behavior
   */
  static config = {
    // Events that should auto-preventDefault
    autoPreventDefaultEvents: ['dragover', 'drop'],
    
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
   * @param {ToolEngine} toolEngine - Tool engine instance
   */
  static async register(registry, toolEngine) {
    const tools = [
      'start',
      'end',
      'drop',
      'dragEnter',
      'dragLeave'
    ];
    
    console.log(`[DragDropModule] Registering ${tools.length + 1} tools...`);
    
    // Register @context/update first (critical for input handling)
    try {
      await toolEngine.registerTool(`context/update`, `@context/update`);
    } catch (error) {
      console.error('[DragDropModule] Failed to register @context/update:', error.message);
    }
    
    // Register drag-drop tools
    for (const tool of tools) {
      try {
        await toolEngine.registerTool(`dragdrop/${tool}`, `@dragdrop/${tool}`);
      } catch (error) {
        console.error(`[DragDropModule] Failed to register @dragdrop/${tool}:`, error.message);
      }
    }
    
    // Register module with config (even if some tools failed)
    registry.registerModule('dragdrop', DragDropModule, {
      version: '1.0.0',
      description: 'Drag-and-drop tools and configuration',
      namespace: '@dragdrop',
      tools: tools.map(t => `@dragdrop/${t}`).concat(['@context/update'])
    });
    
    console.log('[DragDropModule] Registration complete');
  }

  /**
   * Query method for module configuration
   * @param {string} query - Query string
   * @returns {any}
   */
  static query(query) {
    // Allow querying configuration
    if (query === 'config') {
      return DragDropModule.config;
    }
    
    if (query === 'autoPreventDefaultEvents') {
      return DragDropModule.config.autoPreventDefaultEvents;
    }
    
    if (query === 'visualFeedback') {
      return DragDropModule.config.visualFeedback;
    }
    
    if (query === 'allowedDraggableTags') {
      return DragDropModule.config.allowedDraggableTags;
    }
    
    if (query === 'allowedDropzoneTags') {
      return DragDropModule.config.allowedDropzoneTags;
    }
    
    // Check if specific config key exists
    if (query in DragDropModule.config) {
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
  // Get toolEngine from registry context (will be set by kernel)
  const toolEngine = registry._toolEngine;
  if (!toolEngine) {
    throw new Error('[DragDropModule] ToolEngine not available in registry context');
  }
  
  await DragDropModule.register(registry, toolEngine);
}
