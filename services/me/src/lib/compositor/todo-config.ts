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
        { id: "1", text: "Learn Svelte stores", status: "todo" },
        { id: "2", text: "Build compositor page", status: "done" },
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

  // View Configuration - Generic mapping of data to UI slots
  view: {
    slots: [
      { slot: "title", dataPath: "data.title", type: "text" },
      { slot: "description", dataPath: "data.description", type: "text" },
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
      },
      { slot: "list.item.text", dataPath: "data.todos.text", type: "text" },
      { slot: "list.item.completed", dataPath: "data.todos.completed", type: "text" },
      {
        slot: "list.item.id",
        dataPath: "data.todos.id",
        type: "text",
        events: {
          onToggle: "TOGGLE_TODO",
          onDelete: "REMOVE_TODO",
          onDrop: "UPDATE_TODO_STATUS",
        },
      },
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
      },
      {
        slot: "error",
        dataPath: "data.error",
        type: "text",
      },
      {
        slot: "clearTodos",
        dataPath: "data.todos",
        type: "button",
        config: {
          label: "Clear All Todos",
        },
        events: {
          onClick: "CLEAR_TODOS",
        },
      },
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
      },
    ],
  },
  // Layout Configuration - Universal layout engine using CSS Grid/Flexbox
  layout: {
    type: "stack", // Stack layout (flex column)
    height: "calc(100vh - 5rem)", // Full height minus padding
    container: {
      class: "h-full flex flex-col",
      padding: "1.5rem",
      borderRadius: "1.5rem",
      background: "rgb(248 250 252)", // slate-50
      border: "1px solid white",
    },
    slots: [
      {
        slot: "header",
        // Fixed header slot
        position: {
          type: "sticky",
          top: "0",
          zIndex: 10,
        },
        size: {
          height: "auto",
          minHeight: "120px",
        },
        layout: {
          type: "stack",
          container: {
            padding: "0",
            background: "transparent",
          },
          slots: [
            {
              slot: "title",
              size: {
                height: "auto",
              },
            },
            {
              slot: "description",
              size: {
                height: "auto",
              },
            },
            {
              slot: "viewToggle",
              size: {
                height: "auto",
              },
            },
          ],
        },
      },
      {
        slot: "inputSection",
        // Fixed input section (like header)
        position: {
          type: "sticky",
          top: "0",
          zIndex: 9,
        },
        size: {
          height: "auto",
        },
        layout: {
          type: "stack",
          container: {
            padding: "1.5rem 0 0 0",
            background: "rgb(248 250 252)", // slate-50 - match container background
          },
          slots: [
            {
              slot: "input.value",
              size: {
                height: "auto",
              },
            },
            {
              slot: "error",
              size: {
                height: "auto",
              },
            },
          ],
        },
      },
      {
        slot: "content",
        // Scrollable content area
        flex: {
          grow: 1,
          shrink: 1,
          basis: "0",
        },
        overflow: "auto",
        layout: {
          type: "stack",
          container: {
            padding: "1.5rem 0 0 0",
          },
          slots: [
            {
              slot: "list",
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
};
