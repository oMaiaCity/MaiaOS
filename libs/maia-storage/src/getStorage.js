/**
 * Unified Storage Factory
 * Runtime-aware storage selection based on environment and configuration
 *
 * PGlite is server-only (Node.js) - imported dynamically to avoid pulling fs/path
 * into browser bundles. Browser always uses IndexedDB.
 */

import { getIndexedDBStorageAdapter } from './adapters/indexeddb.js'

function detectRuntime() {
	if (typeof EdgeRuntime !== 'undefined' || typeof Deno !== 'undefined') return 'edge'
	if (typeof process !== 'undefined' && process.versions?.node) return 'node'
	return 'browser'
}

function getEnvVar(key) {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		return import.meta.env[key] || import.meta.env[`VITE_${key}`]
	}
	if (typeof process !== 'undefined' && process.env) {
		return process.env[key]
	}
	return undefined
}

const inMemory = () => undefined

/**
 * Get storage instance based on runtime and configuration
 * Agent mode: PEER_STORAGE, DB_PATH
 * Human mode: MAIA_STORAGE (defaults to indexeddb in browser)
 *
 * @param {Object} [options]
 * @param {'human' | 'agent'} [options.mode='human']
 * @param {string} [options.dbPath]
 * @param {boolean} [options.inMemory]
 * @returns {Promise<StorageAPI | undefined>}
 */
export async function getStorage(options = {}) {
	const { mode = 'human', dbPath, inMemory: forceInMemory } = options
	const runtime = detectRuntime()
	const storageType =
		mode === 'agent'
			? typeof process !== 'undefined' && process.env?.PEER_STORAGE
			: getEnvVar('MAIA_STORAGE')

	if (forceInMemory === true || runtime === 'edge' || storageType === 'in-memory') {
		return inMemory()
	}

	if (runtime === 'browser') {
		if (storageType === 'indexeddb' || (!storageType && mode === 'human')) {
			const storage = await getIndexedDBStorageAdapter()
			return storage ?? inMemory()
		}
		return inMemory()
	}

	if (runtime === 'node') {
		const finalDbPath = dbPath || (typeof process !== 'undefined' && process.env?.DB_PATH)
		const databaseUrl = typeof process !== 'undefined' && process.env?.PEER_DB_URL

		// Postgres (Fly MPG or any Postgres)
		if (storageType === 'postgres' && !forceInMemory) {
			if (!databaseUrl) {
				throw new Error('[STORAGE] PEER_STORAGE=postgres requires PEER_DB_URL env var')
			}
			try {
				const { getPostgresStorage } = await import('./adapters/postgres.js')
				return await getPostgresStorage(databaseUrl)
			} catch (error) {
				throw new Error(
					`[STORAGE] Postgres storage initialization FAILED. ` +
						`Original error: ${error?.message || error}`,
				)
			}
		}

		const usePGlite =
			(finalDbPath && !forceInMemory) || (storageType === 'pglite' && !forceInMemory && finalDbPath)

		if (usePGlite && finalDbPath) {
			try {
				const { getPGliteStorage } = await import('./adapters/pglite.js')
				return await getPGliteStorage(finalDbPath)
			} catch (error) {
				if (storageType === 'pglite') {
					throw new Error(
						`[STORAGE] PGlite storage initialization FAILED at ${finalDbPath}. ` +
							`Storage type is explicitly set to 'pglite' via PEER_STORAGE env var - refusing to fall back. ` +
							`Original error: ${error?.message || error}`,
					)
				}
				return inMemory()
			}
		}
	}

	return inMemory()
}
