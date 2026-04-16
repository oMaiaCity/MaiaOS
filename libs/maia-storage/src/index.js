/**
 * @MaiaOS/storage - Centralized Storage Adapters
 * IndexedDB (browser), PGlite (Node.js), in-memory (edge/testing)
 *
 * clearStorageForReseed is Node-only (uses pg, fs). Import from '@MaiaOS/storage/clearStorageForReseed'.
 */

export { getStorage } from './getStorage.node.js'
export {
	createStorageInspector,
	STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE,
	STORAGE_INSPECTOR_MAX_QUERY_ROWS,
	STORAGE_INSPECTOR_MAX_TABLE_PAGE,
} from './inspector.js'
