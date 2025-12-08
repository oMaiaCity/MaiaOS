/**
 * UI Slot Configuration Example
 * Demonstrates generic mapping of data sources to UI slots
 * 
 * This shows how to map ANY data structure to UI slots using dot notation paths
 */

import type { CompositorConfig } from "../types";

/**
 * Example: Todo List with UI Slots
 * Maps data.todos array to a list slot, with nested item slots
 */
export const todoUISlotConfig: CompositorConfig = {
  stateMachine: {
    initial: "idle",
    data: {
      title: "Hello Earth",
      description: "Welcome to the Compositor!",
      todos: [
        { id: "1", text: "Learn Svelte stores", completed: false },
        { id: "2", text: "Build compositor page", completed: true },
      ],
      newTodoText: "",
      isLoading: false,
      error: null,
    },
    states: {
      idle: {
        on: {
          ADD_TODO: { target: "idle", actions: ["@todo/addTodo"] },
          TOGGLE_TODO: { target: "idle", actions: ["@todo/toggleTodo"] },
          REMOVE_TODO: { target: "idle", actions: ["@todo/removeTodo"] },
          UPDATE_INPUT: { target: "idle", actions: ["@ui/updateInput"] },
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
  // UI Slot Configuration - Generic mapping of data to UI slots
  uiSlots: {
    slots: [
      // Simple text slots
      { slot: "title", dataPath: "data.title", type: "text" },
      { slot: "description", dataPath: "data.description", type: "text" },

      // List slot - maps to data.todos array
      { slot: "list", dataPath: "data.todos", type: "list" },

      // List item slots - nested paths for array items
      // These automatically map to each item in the list
      { slot: "list.item.text", dataPath: "data.todos.text", type: "text" },
      { slot: "list.item.completed", dataPath: "data.todos.completed", type: "text" },
      { slot: "list.item.id", dataPath: "data.todos.id", type: "text" },

      // Input slot
      { slot: "input.value", dataPath: "data.newTodoText", type: "input" },

      // Error slot
      { slot: "error", dataPath: "data.error", type: "text" },
    ],
  },
};

/**
 * Example: Generic Product List
 * Shows how the same system works with ANY data structure
 */
export const productUISlotConfig: CompositorConfig = {
  stateMachine: {
    initial: "idle",
    data: {
      title: "Products",
      products: [
        { id: "1", name: "Product A", price: 29.99, inStock: true },
        { id: "2", name: "Product B", price: 49.99, inStock: false },
      ],
      searchQuery: "",
    },
    states: {
      idle: {},
    },
    actions: {},
  },
  uiSlots: {
    slots: [
      { slot: "title", dataPath: "data.title", type: "text" },
      { slot: "list", dataPath: "data.products", type: "list" },
      { slot: "list.item.name", dataPath: "data.products.name", type: "text" },
      { slot: "list.item.price", dataPath: "data.products.price", type: "text" },
      { slot: "list.item.inStock", dataPath: "data.products.inStock", type: "text" },
      { slot: "input.value", dataPath: "data.searchQuery", type: "input" },
    ],
  },
};

/**
 * Slot Path Syntax:
 * 
 * Simple paths:
 *   - "data.title" → data.title
 *   - "data.description" → data.description
 * 
 * Array paths (for lists):
 *   - "data.todos" → entire array
 *   - "data.todos.text" → text property of each item
 *   - "data.todos.0.text" → text of first item only
 * 
 * Nested object paths:
 *   - "data.user.name" → data.user.name
 *   - "data.user.profile.avatar" → data.user.profile.avatar
 * 
 * Slot naming convention:
 *   - "title" → simple slot
 *   - "list" → list slot (expects array)
 *   - "list.item.*" → item slots within a list
 *   - "input.value" → input value slot
 *   - "button.label" → button label slot
 */

