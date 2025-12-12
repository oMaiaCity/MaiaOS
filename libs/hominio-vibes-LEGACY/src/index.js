/**
 * @hominio/vibes - Function loader and UI renderer
 */

// Export UI components - re-export from @hominio/brand/views
export { TodoView } from '@hominio/brand/views'
// Export todo store functions
export {
	addTodo,
	deleteTodo,
	getTodos,
	todoConfig,
	todos,
	toggleTodo,
} from '../lib/functions/todo-store.js'
// Export call config loader
export { buildInitialSystemInstruction, loadCallConfig } from './call-config-loader.js'
export { loadFunction } from './function-loader.js'
// Export system instruction builder
export { buildSystemInstruction } from './system-instruction-builder.js'
export { default as UIRenderer } from './ui-renderer.svelte'
