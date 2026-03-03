/**
 * Unified Storage Factory
 * Runtime-aware storage selection based on environment and configuration
 *
 * Browser: OPFS first (~4x faster for blobs), IndexedDB fallback when OPFS unavailable.
 * Node: PGlite or Postgres for agent mode.
 */

import { getIndexedDBStorageAdapter } from './adapters/indexeddb.js'
import {
	getOPFSStorageAdapter,
	isOPFSAvailableAdapter as isOPFSAvailable,
} from './adapters/opfs.js'

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

const _inMemory = () => undefined

/**
 * Get storage instance based on runtime and configuration
 * Agent mode: PEER_SYNC_STORAGE, PEER_DB_PATH
 * Human mode (browser): OPFS first, IndexedDB fallback (MAIA_STORAGE=indexeddb to force)
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
			? typeof process !== 'undefined' && process.env?.PEER_SYNC_STORAGE
			: getEnvVar('MAIA_STORAGE')

	if (runtime === 'edge') {
		throw new Error('[STORAGE] Edge runtime has no persistent storage. No in-memory fallback.')
	}
	if (storageType === 'in-memory') {
		throw new Error('[STORAGE] in-memory storage disabled. Use OPFS, IndexedDB, PGlite, or Postgres.')
	}
	if (forceInMemory === true) {
		// STRICT: in-memory storage is forbidden in MaiaOS.
		// Fallback to human storage (OPFS/IndexedDB) even if inMemory was requested.
		console.warn(
			'[STORAGE] in-memory storage requested but forbidden. Falling back to persistent storage.',
		)
	}

	if (runtime === 'browser') {
		// OPFS first (best for blob-heavy local-first). IndexedDB fallback when OPFS unavailable.
		if (storageType !== 'indexeddb' && isOPFSAvailable()) {
			const storage = await getOPFSStorageAdapter()
			if (storage) {
				storage.__maiaBackend = 'opfs'
				console.log('[Storage] Using OPFS (File System Access API)')
				return storage
			}
		}
		const storage = await getIndexedDBStorageAdapter()
		if (storage) {
			storage.__maiaBackend = 'indexeddb'
			console.log('[Storage] Using IndexedDB (OPFS unavailable or MAIA_STORAGE=indexeddb)')
			return storage
		}
		throw new Error(
			'[STORAGE] Browser storage failed. OPFS and IndexedDB both unavailable. Use a supported browser (Chrome, Safari, Edge).',
		)
	}

	if (runtime === 'node') {
		const finalDbPath = dbPath || (typeof process !== 'undefined' && process.env?.PEER_DB_PATH)
		const databaseUrl = typeof process !== 'undefined' && process.env?.PEER_DB_URL

		// Agent/server mode: pglite, postgres, or jazz-cloud. Never fall back to in-memory (except jazz-cloud).
		if (mode === 'agent' && !forceInMemory) {
			if (storageType === 'in-memory' || storageType === 'jazz-cloud') {
				throw new Error(
					'[STORAGE] Agent/server mode does not support in-memory storage. Use PEER_STORAGE=pglite, PEER_STORAGE=postgres, or PEER_STORAGE=jazz-cloud.',
				)
			}
			if (
				storageType &&
				storageType !== 'pglite' &&
				storageType !== 'postgres' &&
				storageType !== 'jazz-cloud'
			) {
				throw new Error(
					`[STORAGE] Agent/server mode requires PEER_STORAGE=pglite, PEER_STORAGE=postgres, or PEER_STORAGE=jazz-cloud. Got: ${storageType}`,
				)
			}
		}

		// Jazz Cloud (remote sync/persistence via wss://cloud.jazz.tools)
		if (storageType === 'jazz-cloud') {
			const apiKey = typeof process !== 'undefined' && process.env?.JAZZ_SYNC_API_KEY?.trim?.()
			if (!apiKey) {
				throw new Error(
					'[STORAGE] PEER_STORAGE=jazz-cloud requires JAZZ_SYNC_API_KEY. Get a key at dashboard.jazz.tools or use your email as a temporary key.',
				)
			}
			return inMemory()
		}

		// Postgres (Fly MPG or any Postgres)
		if (storageType === 'postgres' && !forceInMemory) {
			if (!databaseUrl) {
				throw new Error('[STORAGE] PEER_SYNC_STORAGE=postgres requires PEER_DB_URL env var')
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
				'[STORAGE] Agent mode requires PEER_STORAGE=pglite (with PEER_DB_PATH), PEER_STORAGE=postgres (with PEER_DB_URL), or PEER_STORAGE=jazz-cloud (with JAZZ_SYNC_API_KEY).',
			)
		}
	}

	throw new Error(
		`[STORAGE] No persistent storage configured for runtime=${runtime} mode=${mode}. No in-memory fallback.`,
	)
}
