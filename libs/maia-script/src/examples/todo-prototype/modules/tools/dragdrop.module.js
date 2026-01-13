/**
 * DragDrop Tools Module
 * Handles drag-and-drop state management
 */

export const dragdropModule = {
  name: 'dragdrop',
  version: '1.0.0',
  
  tools: {
    '@dragdrop/start': {
      metadata: {
        id: '@dragdrop/start',
        name: 'Start Drag',
        description: 'Initialize drag operation',
      },
      execute: (actor, payload) => {
        const { entityType, id } = payload;
        
        // Find the entity being dragged
        const entities = actor.context[entityType] || [];
        const entity = entities.find(e => e.id === id);
        
        actor.context.dragState = {
          entityType,
          id,
          entity: entity ? { ...entity } : null,
        };
      }
    },

    '@dragdrop/end': {
      metadata: {
        id: '@dragdrop/end',
        name: 'End Drag',
        description: 'Clear drag state',
      },
      execute: (actor, payload) => {
        actor.context.dragState = null;
      }
    },

    '@dragdrop/dragEnter': {
      metadata: {
        id: '@dragdrop/dragEnter',
        name: 'Drag Enter',
        description: 'Visual feedback when dragging over drop zone',
      },
      execute: (actor, payload) => {
        // Visual feedback is handled by CSS
        // This handler exists to prevent errors and allow preventDefault
      }
    },

    '@dragdrop/dragLeave': {
      metadata: {
        id: '@dragdrop/dragLeave',
        name: 'Drag Leave',
        description: 'Remove visual feedback when leaving drop zone',
      },
      execute: (actor, payload) => {
        // Visual feedback is handled by CSS
        // This handler exists to prevent errors and allow preventDefault
      }
    },

    '@dragdrop/drop': {
      metadata: {
        id: '@dragdrop/drop',
        name: 'Handle Drop',
        description: 'Process drop event',
      },
      execute: (actor, payload) => {
        if (!actor.context.dragState) return;
        
        const { targetColumn } = payload;
        const { entityType, id } = actor.context.dragState;
        
        // Update entity's status/column
        const entities = actor.context[entityType];
        if (!entities) return;
        
        actor.context[entityType] = entities.map(e =>
          e.id === id ? { ...e, done: targetColumn === 'done' } : e
        );
        
        // Update filtered arrays if they exist
        if (actor.context.todosTodo && actor.context.todosDone) {
          actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
          actor.context.todosDone = actor.context.todos.filter(t => t.done);
        }
        
        // Clear drag state
        actor.context.dragState = null;
      }
    },
  }
};
