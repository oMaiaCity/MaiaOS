import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class DragDropModule {
  static config = {
    autoPreventDefaultEvents: ['dragover', 'drop', 'dragenter'],
    visualFeedback: {
      draggableClass: 'cursor-move',
      draggingClass: 'opacity-50',
      dragOverClass: 'bg-blue-50 border-blue-300'
    },
    dragEffects: {
      allowed: ['move', 'copy', 'link'],
      default: 'move'
    },
    allowedDraggableTags: ['div', 'section', 'article', 'li', 'span', 'button'],
    allowedDropzoneTags: ['div', 'section', 'article', 'ul', 'ol']
  };

  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'DragDropModule');
    const toolNames = ['start', 'end', 'drop', 'dragOver'];
    await registerToolsFromRegistry(registry, toolEngine, 'dragdrop', toolNames, '@dragdrop');
    registerModuleConfig(registry, 'dragdrop', DragDropModule, {
      version: '1.0.0',
      description: 'Drag-and-drop tools and configuration',
      namespace: '@dragdrop',
      tools: toolNames.map(t => `@dragdrop/${t}`)
    });
  }

  static query(query) {
    if (query === 'config') return DragDropModule.config;
    if (Object.prototype.hasOwnProperty.call(DragDropModule.config, query)) {
      return DragDropModule.config[query];
    }
    return null;
  }

  static shouldPreventDefault(eventType) {
    return DragDropModule.config.autoPreventDefaultEvents.includes(eventType);
  }
}

export async function register(registry) {
  await DragDropModule.register(registry);
}
