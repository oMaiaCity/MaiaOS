/**
 * IndexedDB Storage Adapter
 * Browser-only storage using IndexedDB for CoValue persistence
 */

import { getIndexedDBStorage } from "cojson-storage-indexeddb";

/**
 * Get IndexedDB storage for CoValue persistence
 * 
 * This enables:
 * - Automatic persistence of all CoValues to IndexedDB
 * - Fast offline loading from local cache
 * - Survival across page reloads
 * - Storage acts as "local peer" in cojson architecture
 * 
 * @returns {Promise<StorageAPI | undefined>} Storage instance or undefined if unavailable
 */
export async function getIndexedDBStorageAdapter() {
	try {
		const storage = await getIndexedDBStorage();
		return storage;
	} catch {
		return undefined;
	}
}
