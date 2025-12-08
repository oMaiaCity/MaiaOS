/**
 * Compositor Actions - Action implementations
 * All actions operate on unified data - no distinction between data types
 */

import type { Data, Action, StateMachineConfig } from "./dataStore";

/**
 * Create compositor actions
 * All actions work with unified data interface
 */
export function createCompositorActions(): Record<string, Action> {
  return {
    validateTodo: (data: Data, payload?: unknown) => {
      const text = (payload as { text?: string })?.text || (data.newTodoText as string) || "";
      if (!text.trim()) {
        data.error = "Todo text cannot be empty";
        return;
      }
      data.error = null;
    },

    addTodo: (data: Data, payload?: unknown) => {
      const text = (payload as { text?: string })?.text || (data.newTodoText as string) || "";
      if (!text.trim()) {
        data.error = "Todo text cannot be empty";
        return;
      }

      const newTodo = {
        id: Date.now().toString(),
        text: text.trim(),
        completed: false,
      };

      const todos = (data.todos as Array<unknown>) || [];
      data.todos = [...todos, newTodo];
      data.error = null;
    },

    toggleTodo: (data: Data, payload?: unknown) => {
      const todoId = (payload as { todoId?: string })?.todoId;
      if (!todoId) return;

      const todos = (data.todos as Array<{ id: string; completed: boolean }>) || [];
      data.todos = todos.map((todo) =>
        todo.id === todoId ? { ...todo, completed: !todo.completed } : todo,
      );
    },

    removeTodo: (data: Data, payload?: unknown) => {
      const todoId = (payload as { todoId?: string })?.todoId;
      if (!todoId) return;

      const todos = (data.todos as Array<{ id: string }>) || [];
      data.todos = todos.filter((todo) => todo.id !== todoId);
    },

    updateInput: (data: Data, payload?: unknown) => {
      const text = (payload as { text?: string })?.text;
      if (text !== undefined) {
        data.newTodoText = text;
      }
    },

    clearInput: (data: Data) => {
      data.newTodoText = "";
    },
  };
}

/**
 * Merge actions into config
 */
export function mergeActionsIntoConfig(
  config: StateMachineConfig,
  actions: Record<string, Action>,
): StateMachineConfig {
  return {
    ...config,
    actions: {
      ...config.actions,
      ...actions,
    },
  };
}
