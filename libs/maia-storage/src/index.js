/**
 * @MaiaOS/storage - Centralized Storage Adapters
 * IndexedDB (browser), PGlite (Node.js), in-memory (edge/testing)
 *
 * clearStorageForReseed is Node-only (uses pg, fs). Import from '@MaiaOS/storage/clearStorageForReseed'.
 */

export { getStorage } from './getStorage.node.js'
