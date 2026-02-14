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
 * Agent mode: PEER_STORAGE, PEER_DB_PATH
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
		if (mode === 'agent') {
			throw new Error(
				'[STORAGE] Agent/server mode does not support in-memory storage. Use PEER_STORAGE=pglite or PEER_STORAGE=postgres.',
			)
		}
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
		const finalDbPath = dbPath || (typeof process !== 'undefined' && process.env?.PEER_DB_PATH)
		const databaseUrl = typeof process !== 'undefined' && process.env?.PEER_DB_URL

		// Agent/server mode: ONLY pglite or postgres. Never fall back to in-memory.
		if (mode === 'agent' && !forceInMemory) {
			if (storageType === 'in-memory') {
				throw new Error(
					'[STORAGE] Agent/server mode does not support in-memory storage. Use PEER_STORAGE=pglite or PEER_STORAGE=postgres.',
				)
			}
			if (storageType && storageType !== 'pglite' && storageType !== 'postgres') {
				throw new Error(
					`[STORAGE] Agent/server mode requires PEER_STORAGE=pglite or PEER_STORAGE=postgres. Got: ${storageType}`,
				)
			}
		}

		// Postgres (Fly MPG or any Postgres)
		if (storageType === 'postgres' && !forceInMemory) {
			if (!databaseUrl) {
				throw new Error('[STORAGE] PEER_STORAGE=postgres requires PEER_DB_URL env var')
			}
			try {
				const { getPostgresStorage } = await import('@MaiaOS/storage/adapters/postgres.js')
				return await getPostgresStorage(databaseUrl)
			} catch (error) {
				throw new Error(
					`[STORAGE] Postgres storage initialization FAILED. ` +
						`Original error: ${error?.message || error}`,
				)
			}
		}

		// PGlite (local WASM Postgres)
		if (
			(storageType === 'pglite' || (storageType !== 'postgres' && finalDbPath)) &&
			!forceInMemory &&
			finalDbPath
		) {
			try {
				const { getPGliteStorage } = await import('@MaiaOS/storage/adapters/pglite.js')
				return await getPGliteStorage(finalDbPath)
			} catch (error) {
				throw new Error(
					`[STORAGE] PGlite storage initialization FAILED at ${finalDbPath}. ` +
						`Original error: ${error?.message || error}`,
				)
			}
		}

		// Agent mode with no valid storage → fail hard
		if (mode === 'agent') {
			throw new Error(
				'[STORAGE] Agent mode requires PEER_STORAGE=pglite (with PEER_DB_PATH) or PEER_STORAGE=postgres (with PEER_DB_URL).',
			)
		}
	}

	return inMemory()
}
