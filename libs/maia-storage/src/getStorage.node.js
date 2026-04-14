/**
 * Unified Storage Factory
 * Runtime-aware storage selection based on environment and configuration
 *
 * Browser: OPFS first (~4x faster for blobs), IndexedDB fallback when OPFS unavailable.
 * Node: PGlite or Postgres for agent mode.
 */

import { createOpsLogger, OPS_PREFIX } from '@MaiaOS/logs'
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

const opsStorage = createOpsLogger('Storage')
const opsStorErr = createOpsLogger('STORAGE')

/**
 * Create the appropriate BlobStore based on environment.
 * BUCKET_NAME set → Tigris (production, Fly.io).
 * Otherwise → local filesystem at PEER_BLOB_PATH or ./binary-bucket.
 * Only created in Node.js server context.
 */
async function createBlobStore() {
	const bucketName = typeof process !== 'undefined' && process.env?.BUCKET_NAME
	if (bucketName) {
		const { TigrisBlobStore } = await import('./blob/tigris.js')
		opsStorage.log('BlobStore: Tigris (bucket=%s)', bucketName)
		return new TigrisBlobStore(bucketName)
	}
	const blobPath =
		(typeof process !== 'undefined' && process.env?.PEER_BLOB_PATH) || './binary-bucket'
	const { resolve } = await import('node:path')
	const resolvedPath = resolve(blobPath)
	const { LocalFsBlobStore } = await import('./blob/local-fs.js')
	opsStorage.log('BlobStore: local filesystem (%s)', resolvedPath)
	return new LocalFsBlobStore(resolvedPath)
}

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
		throw new Error(
			`${OPS_PREFIX.STORAGE} Edge runtime has no persistent storage. No in-memory fallback.`,
		)
	}
	if (storageType === 'in-memory') {
		throw new Error(
			`${OPS_PREFIX.STORAGE} in-memory storage disabled. Use OPFS, IndexedDB, PGlite, or Postgres.`,
		)
	}
	if (forceInMemory === true) {
		// STRICT: in-memory storage is forbidden in MaiaOS.
		// Fallback to human storage (OPFS/IndexedDB) even if inMemory was requested.
		opsStorErr.warn('in-memory storage requested but forbidden. Falling back to persistent storage.')
	}

	if (runtime === 'browser') {
		// OPFS first (best for blob-heavy local-first). IndexedDB fallback when OPFS unavailable.
		if (storageType !== 'indexeddb' && isOPFSAvailable()) {
			const storage = await getOPFSStorageAdapter()
			if (storage) {
				storage.__maiaBackend = 'opfs'
				opsStorage.log('Using OPFS (File System Access API)')
				return storage
			}
		}
		const storage = await getIndexedDBStorageAdapter()
		if (storage) {
			storage.__maiaBackend = 'indexeddb'
			opsStorage.log('Using IndexedDB (OPFS unavailable or MAIA_STORAGE=indexeddb)')
			return storage
		}
		throw new Error(
			`${OPS_PREFIX.STORAGE} Browser storage failed. OPFS and IndexedDB both unavailable. Use a supported browser (Chrome, Safari, Edge).`,
		)
	}

	if (runtime === 'node') {
		const finalDbPath = dbPath || (typeof process !== 'undefined' && process.env?.PEER_DB_PATH)
		const databaseUrl = typeof process !== 'undefined' && process.env?.PEER_SYNC_DB_URL

		// Agent/server mode: pglite or postgres only. No in-memory or jazz-cloud.
		if (mode === 'agent' && !forceInMemory) {
			if (storageType === 'in-memory' || storageType === 'jazz-cloud') {
				throw new Error(
					`${OPS_PREFIX.STORAGE} Agent/server requires persistent storage. Use PEER_SYNC_STORAGE=pglite or PEER_SYNC_STORAGE=postgres. No in-memory or jazz-cloud.`,
				)
			}
			if (storageType && storageType !== 'pglite' && storageType !== 'postgres') {
				throw new Error(
					`${OPS_PREFIX.STORAGE} Agent/server mode requires PEER_SYNC_STORAGE=pglite or PEER_SYNC_STORAGE=postgres. Got: ${storageType}`,
				)
			}
		}

		const blobStore = await createBlobStore()

		// Postgres (Fly MPG or any Postgres)
		if (storageType === 'postgres' && !forceInMemory) {
			if (!databaseUrl) {
				throw new Error(
					`${OPS_PREFIX.STORAGE} PEER_SYNC_STORAGE=postgres requires PEER_SYNC_DB_URL env var`,
				)
			}
			try {
				const { getPostgresStorage } = await import('@MaiaOS/storage/adapters/postgres.js')
				return await getPostgresStorage(databaseUrl, blobStore)
			} catch (error) {
				throw new Error(
					`${OPS_PREFIX.STORAGE} Postgres storage initialization FAILED. ` +
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
				return await getPGliteStorage(finalDbPath, blobStore)
			} catch (error) {
				throw new Error(
					`${OPS_PREFIX.STORAGE} PGlite storage initialization FAILED at ${finalDbPath}. ` +
						`Original error: ${error?.message || error}`,
				)
			}
		}

		// Agent mode with no valid storage → fail hard
		if (mode === 'agent') {
			throw new Error(
				`${OPS_PREFIX.STORAGE} Agent mode requires PEER_SYNC_STORAGE=pglite (with PEER_DB_PATH) or PEER_SYNC_STORAGE=postgres (with PEER_SYNC_DB_URL).`,
			)
		}
	}

	throw new Error(
		`${OPS_PREFIX.STORAGE} No persistent storage configured for runtime=${runtime} mode=${mode}. No in-memory fallback.`,
	)
}
