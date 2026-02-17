/**
 * MaiaOS Operations Package
 *
 * Shared operations layer for database operations.
 * Works with MaiaDB or any backend implementing read/create/update/delete.
 */

export { DBEngine } from './engine.js'
export {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
	isSuccessResult,
} from './operation-result.js'
export { ReactiveStore } from './reactive-store.js'
