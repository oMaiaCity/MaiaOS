/**
 * @hominio/vibes - Function loader and UI renderer
 */

export { loadFunction } from './function-loader.js';
export { default as UIRenderer } from './ui-renderer.svelte';

// Export system instruction builder
export { buildSystemInstruction } from './system-instruction-builder.js';

// Export call config loader
export { loadCallConfig, buildInitialSystemInstruction } from './call-config-loader.js';

// Export UI components - re-export from @hominio/brand/views
export { TodoView } from '@hominio/brand/views';

// Export todo store functions
export { getTodos, todos, todoConfig, addTodo, toggleTodo, deleteTodo } from '../lib/functions/todo-store.js';

