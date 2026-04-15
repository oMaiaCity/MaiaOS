/**
 * OPFS (Origin Private File System) Storage Adapter
 * Browser-only storage using OPFS for CoValue persistence.
 * ~4x faster than IndexedDB for large data (e.g. CoBinary uploads).
 *
 * Falls back to IndexedDB when OPFS is unavailable (private mode, older browsers).
 */

import { StorageApiAsync } from 'cojson/dist/storage/storageAsync.js'
import { OPFSClient } from './opfs/opfsClient.js'
import { getOPFSRoot, isOPFSAvailable } from './opfs/opfsHelpers.js'

/**
 * Check if OPFS is available in the current browser.
 * @returns {boolean}
 */
export function isOPFSAvailableAdapter() {
	return isOPFSAvailable()
}

/**
 * Get OPFS storage for CoValue persistence.
 *
 * @param {string} [dbName='jazz-storage-opfs']
 * @returns {Promise<StorageAPI | undefined>} Storage instance or undefined if OPFS unavailable/fails
 */
import { DEFAULT_DB_NAME } from './opfs/opfsHelpers.js'

export async function getOPFSStorageAdapter(dbName = DEFAULT_DB_NAME) {
	try {
		if (!isOPFSAvailable()) return undefined
		const root = await getOPFSRoot(dbName)
		const client = new OPFSClient(root)
		return new StorageApiAsync(client)
	} catch {
		return undefined
	}
}
