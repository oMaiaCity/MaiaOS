/**
 * Todo Compositor Configuration
 * 100% JSON-config-based - all data management defined here
 * Uses unified data interface - no distinction between states, context, or data types
 * Skills are referenced by ID and loaded from registry
 */

import type { CompositorConfig } from "./types";

export const todoCompositorConfig: CompositorConfig = {
  stateMachine: {
    initial: "idle",
    // Unified data - everything is just data, no distinction
    data: {
      title: "Hello Earth",
      description: "Welcome to the Compositor!",
      todos: [
        { id: "1", text: "Learn Svelte stores", completed: false },
        { id: "2", text: "Build compositor page", completed: true },
        { id: "3", text: "Add todo list feature", completed: false },
      ],
      newTodoText: "",
      isLoading: false,
      error: null,
    },
    states: {
      idle: {
        on: {
          ADD_TODO: {
            target: "adding",
            actions: ["@todo/validateTodo", "@todo/addTodo"],
          },
          TOGGLE_TODO: {
            target: "idle",
            actions: ["@todo/toggleTodo"],
          },
          REMOVE_TODO: {
            target: "idle",
            actions: ["@todo/removeTodo"],
          },
          UPDATE_INPUT: {
            target: "idle",
            actions: ["@ui/updateInput"],
          },
        },
      },
      adding: {
        entry: ["@ui/clearInput"],
        on: {
          SUCCESS: "idle",
          ERROR: "error",
        },
      },
      error: {
        on: {
          RETRY: "idle",
          CLEAR_ERROR: "idle",
        },
      },
    },
    actions: {},
  },
  ui: {
    containerClass: "min-h-screen bg-gray-100 pt-20 px-4",
    cardClass:
      "relative overflow-hidden rounded-3xl bg-slate-50 border border-white shadow-card-default p-6",
  },
};
