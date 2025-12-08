/**
 * Todo Vibe Configuration
 * 100% JSON-config-based - all data management defined here
 * Uses unified data interface - no distinction between states, context, or data types
 * Skills are referenced by ID and loaded from registry
 * Uses Composite/Leaf pattern: composites contain children, leaves contain dataPath
 */

import type { VibeConfig } from "./types";

export const todoVibeConfig: VibeConfig = {
  stateMachine: {
    initial: "idle",
    // Unified data - everything is just data, no distinction
    data: {
      title: "Hello Earth",
      description: "Welcome to the Vibe!",
      todos: [
        { id: "1", text: "Learn Svelte stores", status: "todo" },
        { id: "2", text: "Build vibe page", status: "done" },
        { id: "3", text: "Add todo list feature", status: "in-progress" },
      ],
      newTodoText: "",
      isLoading: false,
      error: null,
      viewMode: "list", // "list" | "kanban"
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
          UPDATE_TODO_STATUS: {
            target: "idle",
            actions: ["@todo/updateStatus"],
          },
          TOGGLE_VIEW: {
            target: "idle",
            actions: ["@ui/toggleView"],
          },
          CLEAR_TODOS: {
            target: "idle",
            actions: ["@todo/clearTodos"],
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

  // Unified View Configuration - Composite/Leaf pattern
  // Root is a composite containing all children
  view: {
    composite: {
      type: "stack", // Stack layout (flex column)
      container: {
        class: "h-full flex flex-col",
        padding: "1.5rem",
        borderRadius: "1.5rem",
        background: "rgb(248 250 252)", // slate-50
        border: "1px solid white",
      },
      height: "calc(100vh - 5rem)", // Full height minus padding
      children: [
        // Header Composite - Fixed header containing title, description, viewToggle
        {
          slot: "header",
          position: {
            type: "sticky",
            top: "0",
            zIndex: 10,
          },
          size: {
            height: "auto",
            minHeight: "120px",
          },
          composite: {
            type: "stack",
            container: {
              padding: "0",
              background: "transparent",
            },
            children: [
              // Title Leaf
              {
                slot: "title",
                dataPath: "data.title",
                type: "text",
                size: {
                  height: "auto",
                },
              },
              // Description Leaf
              {
                slot: "description",
                dataPath: "data.description",
                type: "text",
                size: {
                  height: "auto",
                },
              },
              // View Toggle Leaf
              {
                slot: "viewToggle",
                dataPath: "data.viewMode",
                type: "button",
                config: {
                  label: "Switch View",
                  options: {
                    list: "Switch to List View",
                    kanban: "Switch to Kanban View",
                  },
                },
                events: {
                  onClick: "TOGGLE_VIEW",
                },
                size: {
                  height: "auto",
                },
              },
            ],
          },
        },
        // Input Section Composite - Fixed input section containing input and error
        {
          slot: "inputSection",
          position: {
            type: "sticky",
            top: "0",
            zIndex: 9,
          },
          size: {
            height: "auto",
          },
          composite: {
            type: "stack",
            container: {
              padding: "1.5rem 0 0 0",
              background: "rgb(248 250 252)", // slate-50 - match container background
            },
            children: [
              // Input Leaf
              {
                slot: "input.value",
                dataPath: "data.newTodoText",
                type: "input",
                config: {
                  placeholder: "Add a new todo...",
                  submitLabel: "Add",
                  loadingLabel: "Adding...",
                  inputType: "text",
                  listSlotId: "list",
                  clearSlotId: "clearTodos",
                },
                events: {
                  onSubmit: "ADD_TODO",
                  onInput: "UPDATE_INPUT",
                },
                size: {
                  height: "auto",
                },
              },
              // Error Leaf
              {
                slot: "error",
                dataPath: "data.error",
                type: "text",
                size: {
                  height: "auto",
                },
              },
            ],
          },
        },
        // Content Composite - Scrollable content area containing list
        {
          slot: "content",
          flex: {
            grow: 1,
            shrink: 1,
            basis: "0",
          },
          overflow: "auto",
          composite: {
            type: "stack",
            container: {
              padding: "1.5rem 0 0 0",
            },
            children: [
              // List Leaf - The actual todo list
              {
                slot: "list",
                dataPath: "data.todos",
                type: "list",
                config: {
                  textProperty: "text",
                  statusProperty: "status",
                  deleteLabel: "Delete",
                  emptyStateMessage: "Kanban view requires kanbanColumns configuration",
                  statusBadge: {
                    todo: { label: "Todo", color: "bg-slate-100 text-slate-700" },
                    "in-progress": { label: "In Progress", color: "bg-blue-100 text-blue-700" },
                    done: { label: "Done", color: "bg-green-100 text-green-700" },
                  },
                  kanbanColumns: [
                    { label: "Todo", status: "todo", filter: (item: Record<string, unknown>) => item.status === "todo" },
                    { label: "In Progress", status: "in-progress", filter: (item: Record<string, unknown>) => item.status === "in-progress" },
                    { label: "Done", status: "done", filter: (item: Record<string, unknown>) => item.status === "done" },
                  ],
                },
                events: {
                  onToggle: "TOGGLE_TODO",
                  onDelete: "REMOVE_TODO",
                  onDrop: "UPDATE_TODO_STATUS",
                },
                flex: {
                  grow: 1,
                  shrink: 1,
                  basis: "0",
                },
                overflow: "auto",
              },
            ],
          },
        },
      ],
    },
  },
};

// @deprecated Use todoVibeConfig instead
export const todoCompositorConfig = todoVibeConfig;
