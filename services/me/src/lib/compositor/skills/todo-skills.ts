/**
 * Todo Skills - Independent skill functions for todo operations
 * Each skill is self-contained and can be called independently
 * Future-ready for LLM skill calls
 */

import type { Skill } from "./types";
import type { Data } from "../dataStore";

// ========== SKILL IMPLEMENTATIONS ==========

const validateTodoSkill: Skill = {
  metadata: {
    id: "@todo/validateTodo",
    name: "Validate Todo",
    description: "Validates that todo text is not empty",
    category: "todo",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The todo text to validate",
          required: true,
        },
      },
      required: ["text"],
    },
  },
  execute: (data: Data, payload?: unknown) => {
    const text = (payload as { text?: string })?.text || (data.newTodoText as string) || "";
    if (!text.trim()) {
      data.error = "Todo text cannot be empty";
      return;
    }
    data.error = null;
  },
};

const addTodoSkill: Skill = {
  metadata: {
    id: "@todo/addTodo",
    name: "Add Todo",
    description: "Adds a new todo item to the list",
    category: "todo",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text content of the todo",
          required: true,
        },
      },
      required: ["text"],
    },
  },
  execute: (data: Data, payload?: unknown) => {
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
};

const toggleTodoSkill: Skill = {
  metadata: {
    id: "@todo/toggleTodo",
    name: "Toggle Todo",
    description: "Toggles the completion status of a todo item",
    category: "todo",
    parameters: {
      type: "object",
      properties: {
        todoId: {
          type: "string",
          description: "The ID of the todo to toggle",
          required: true,
        },
      },
      required: ["todoId"],
    },
  },
  execute: (data: Data, payload?: unknown) => {
    const todoId = (payload as { todoId?: string })?.todoId;
    if (!todoId) return;

    const todos = (data.todos as Array<{ id: string; completed: boolean }>) || [];
    data.todos = todos.map((todo) =>
      todo.id === todoId ? { ...todo, completed: !todo.completed } : todo,
    );
  },
};

const removeTodoSkill: Skill = {
  metadata: {
    id: "@todo/removeTodo",
    name: "Remove Todo",
    description: "Removes a todo item from the list",
    category: "todo",
    parameters: {
      type: "object",
      properties: {
        todoId: {
          type: "string",
          description: "The ID of the todo to remove",
          required: true,
        },
      },
      required: ["todoId"],
    },
  },
  execute: (data: Data, payload?: unknown) => {
    const todoId = (payload as { todoId?: string })?.todoId;
    if (!todoId) return;

    const todos = (data.todos as Array<{ id: string }>) || [];
    data.todos = todos.filter((todo) => todo.id !== todoId);
  },
};

const updateInputSkill: Skill = {
  metadata: {
    id: "@ui/updateInput",
    name: "Update Input",
    description: "Updates the input field value",
    category: "ui",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The new input text value",
          required: true,
        },
      },
      required: ["text"],
    },
  },
  execute: (data: Data, payload?: unknown) => {
    const text = (payload as { text?: string })?.text;
    if (text !== undefined) {
      data.newTodoText = text;
    }
  },
};

const clearInputSkill: Skill = {
  metadata: {
    id: "@ui/clearInput",
    name: "Clear Input",
    description: "Clears the input field",
    category: "ui",
  },
  execute: (data: Data) => {
    data.newTodoText = "";
  },
};

const toggleViewSkill: Skill = {
  metadata: {
    id: "@ui/toggleView",
    name: "Toggle View",
    description: "Toggles between list and kanban view modes",
    category: "ui",
  },
  execute: (data: Data) => {
    const currentView = (data.viewMode as string) || "list";
    data.viewMode = currentView === "list" ? "kanban" : "list";
  },
};

const clearTodosSkill: Skill = {
  metadata: {
    id: "@todo/clearTodos",
    name: "Clear Todos",
    description: "Clears all todos from the list",
    category: "todo",
  },
  execute: (data: Data) => {
    data.todos = [];
  },
};

// ========== SKILL EXPORTS ==========

/**
 * All todo-related skills
 * Using npm-style scoped names: @scope/skillName
 */
export const todoSkills: Record<string, Skill> = {
  "@todo/validateTodo": validateTodoSkill,
  "@todo/addTodo": addTodoSkill,
  "@todo/toggleTodo": toggleTodoSkill,
  "@todo/removeTodo": removeTodoSkill,
  "@todo/clearTodos": clearTodosSkill,
  "@ui/updateInput": updateInputSkill,
  "@ui/clearInput": clearInputSkill,
  "@ui/toggleView": toggleViewSkill,
};

