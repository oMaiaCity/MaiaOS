/**
 * MaiaOS Operations Package
 *
 * Shared operations layer for database operations.
 * Works with any backend that implements the DBAdapter interface.
 */

export { DBAdapter } from './db-adapter.js'
export { DBEngine } from './engine.js'
export {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
	isSuccessResult,
} from './operation-result.js'
export { ReactiveStore } from './reactive-store.js'
