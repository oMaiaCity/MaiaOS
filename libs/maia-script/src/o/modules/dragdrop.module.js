/**
 * Drag-Drop Module - @dragdrop/* tools
 * Provides drag-and-drop functionality with configuration
 */

// Import tools from registry
import { getTool } from '../tools/index.js';

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
    // Get toolEngine from registry (stored by kernel during boot)
    const toolEngine = registry._toolEngine;
    if (!toolEngine) {
      throw new Error('[DragDropModule] ToolEngine not available in registry');
    }
    
    const toolNames = [
      'start',
      'end',
      'drop',
      'dragEnter',
      'dragLeave'
    ];
    
    console.log(`[DragDropModule] Registering ${toolNames.length + 1} tools...`);
    
    // Register @context/update first (critical for input handling)
    try {
      const contextUpdateTool = getTool('context/update');
      if (contextUpdateTool) {
        await toolEngine.registerTool('context/update', '@context/update', {
          definition: contextUpdateTool.definition,
          function: contextUpdateTool.function
        });
      }
    } catch (error) {
      console.error('[DragDropModule] Failed to register @context/update:', error.message);
    }
    
    // Register drag-drop tools
    for (const toolName of toolNames) {
      try {
        const namespacePath = `dragdrop/${toolName}`;
        const tool = getTool(namespacePath);
        
        if (tool) {
          await toolEngine.registerTool(namespacePath, `@dragdrop/${toolName}`, {
            definition: tool.definition,
            function: tool.function
          });
        }
      } catch (error) {
        console.error(`[DragDropModule] Failed to register @dragdrop/${toolName}:`, error.message);
      }
    }
    
    // Register module with config (even if some tools failed)
    registry.registerModule('dragdrop', DragDropModule, {
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
  await DragDropModule.register(registry);
}
