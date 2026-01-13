/**
 * Core Tools Module - Generic Entity CRUD
 * Inspired by legacy services/me/src/lib/compositor/tools/core.module.ts
 * 
 * Generic for ANY entity type (not just todos)
 */

export const coreModule = {
  name: 'core',
  version: '1.0.0',
  
  tools: {
    '@core/createEntity': {
      metadata: {
        id: '@core/createEntity',
        name: 'Create Entity',
        description: 'Generic entity creation',
      },
      execute: async (actor, payload) => {
        const { entityType, data, clearField } = payload;
        
        // Generate ID
        const id = `${entityType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Get or create entities array
        const entities = actor.context[entityType] || [];
        
        // Create entity
        const entity = {
          id,
          ...data,
          createdAt: Date.now(),
        };
        
        // Add to context
        actor.context[entityType] = [...entities, entity];
        
        // Clear input field if specified
        if (clearField) {
          actor.context[clearField] = '';
        }
      }
    },

    '@core/updateEntity': {
      metadata: {
        id: '@core/updateEntity',
        name: 'Update Entity',
        description: 'Generic entity update',
      },
      execute: async (actor, payload) => {
        const { entityType, id, updates } = payload;
        
        const entities = actor.context[entityType];
        if (!entities) return;
        
        actor.context[entityType] = entities.map(e =>
          e.id === id ? { ...e, ...updates } : e
        );
      }
    },

    '@core/deleteEntity': {
      metadata: {
        id: '@core/deleteEntity',
        name: 'Delete Entity',
        description: 'Generic entity deletion',
      },
      execute: async (actor, payload) => {
        const { entityType, id } = payload;
        
        const entities = actor.context[entityType];
        if (!entities) return;
        
        actor.context[entityType] = entities.filter(e => e.id !== id);
      }
    },

    '@core/toggleEntity': {
      metadata: {
        id: '@core/toggleEntity',
        name: 'Toggle Entity Property',
        description: 'Toggle boolean property',
      },
      execute: async (actor, payload) => {
        const { entityType, id, property } = payload;
        
        const entities = actor.context[entityType];
        if (!entities) return;
        
        actor.context[entityType] = entities.map(e =>
          e.id === id ? { ...e, [property]: !e[property] } : e
        );
      }
    },

    '@core/preventDefault': {
      metadata: {
        id: '@core/preventDefault',
        name: 'Prevent Default',
        description: 'Prevent default browser behavior (e.g., for dragover)',
      },
      execute: () => {
        // This is handled in ViewEngine event attachment
        // This tool exists for registry lookup but does nothing
      }
    },

    '@core/setViewMode': {
      metadata: {
        id: '@core/setViewMode',
        name: 'Set View Mode',
        description: 'Switch between list and kanban views',
      },
      execute: (actor, payload) => {
        const { viewMode } = payload;
        actor.context.viewMode = viewMode;
      }
    },

    // Legacy todo-specific actions (for backward compatibility)
    '@core/createTodo': {
      metadata: {
        id: '@core/createTodo',
        name: 'Create Todo',
        description: 'Create a new todo (legacy)',
      },
      execute: async (actor, payload) => {
        const { text } = payload;
        
        if (!text || !text.trim()) return;
        
        // Generate ID
        const id = `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Get or create todos array
        const todos = actor.context.todos || [];
        
        // Create todo
        const todo = {
          id,
          text: text.trim(),
          done: false,
          createdAt: Date.now(),
        };
        
        // Add to context
        actor.context.todos = [...todos, todo];
        
        // Clear input
        actor.context.newTodoText = '';
        
        // Update filtered arrays
        actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
        actor.context.todosDone = actor.context.todos.filter(t => t.done);
      }
    },

    '@core/toggleTodo': {
      metadata: {
        id: '@core/toggleTodo',
        name: 'Toggle Todo',
        description: 'Toggle todo done state (legacy)',
      },
      execute: async (actor, payload) => {
        const { id } = payload;
        
        const todos = actor.context.todos;
        if (!todos) return;
        
        actor.context.todos = todos.map(t =>
          t.id === id ? { ...t, done: !t.done } : t
        );
        
        // Update filtered arrays
        actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
        actor.context.todosDone = actor.context.todos.filter(t => t.done);
      }
    },

    '@core/deleteTodo': {
      metadata: {
        id: '@core/deleteTodo',
        name: 'Delete Todo',
        description: 'Delete a todo (legacy)',
      },
      execute: async (actor, payload) => {
        const { id } = payload;
        
        const todos = actor.context.todos;
        if (!todos) return;
        
        actor.context.todos = todos.filter(t => t.id !== id);
        
        // Update filtered arrays
        actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
        actor.context.todosDone = actor.context.todos.filter(t => t.done);
      }
    },

    '@core/noop': {
      metadata: {
        id: '@core/noop',
        name: 'No Operation',
        description: 'Stops event propagation without action',
      },
      execute: () => {
        // No operation
      }
    },
  }
};
