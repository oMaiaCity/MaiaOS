export const config = {
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

export function shouldPreventDefault(eventType) {
  return config.autoPreventDefaultEvents.includes(eventType);
}

export async function register(registry) {
  const toolNames = ['start', 'end', 'drop', 'dragOver'];
  const registeredTools = await registry._registerToolsFromRegistry('dragdrop', toolNames, '@dragdrop');
  registry.registerModule('dragdrop', {
    config,
    query: (q) => {
      if (q === 'config') return config;
      if (Object.prototype.hasOwnProperty.call(config, q)) return config[q];
      return null;
    }
  }, {
    version: '1.0.0',
    description: 'Drag-and-drop tools and configuration',
    namespace: '@dragdrop',
    tools: registeredTools
  });
}
