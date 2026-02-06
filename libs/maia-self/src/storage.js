/**
 * Storage helper for IndexedDB persistence
 * Follows jazz-tools browser context pattern
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
export async function getStorage() {
	try {
		const storage = await getIndexedDBStorage();
		return storage;
	} catch (error) {
		console.warn("⚠️  [STORAGE] IndexedDB unavailable, running without persistence:", error);
		console.warn("   This may happen in incognito mode or unsupported browsers");
		return undefined;
	}
}
