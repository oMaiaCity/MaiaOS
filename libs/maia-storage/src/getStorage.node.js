/**
 * CoValue storage factory (Node).
 * Runtime-driven: **PGlite** or **Postgres** via `PEER_SYNC_STORAGE` (+ `PEER_DB_PATH` / `PEER_SYNC_DB_URL`).
 * Blob store: Tigris when `BUCKET_NAME` is set, else local FS at `PEER_BLOB_PATH` or `./binary-bucket`.
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

const opsStorage = createOpsLogger('Storage')

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
 * CoValue storage: browser **OPFS** (IndexedDB fallback) or Node **PGlite** / **Postgres**.
 *
 * @param {Object} [options]
 * @param {string} [options.dbPath] — Node PGlite directory (overrides `PEER_DB_PATH` when set)
 * @returns {Promise<StorageAPI | undefined>}
 */
export async function getStorage(options = {}) {
	const { dbPath: dbPathOpt } = options
	const runtime = detectRuntime()
	const storageType =
		runtime === 'node'
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

	if (runtime === 'browser') {
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
		const finalDbPath = dbPathOpt || (typeof process !== 'undefined' && process.env?.PEER_DB_PATH)
		const databaseUrl = typeof process !== 'undefined' && process.env?.PEER_SYNC_DB_URL

		if (!storageType || (storageType !== 'pglite' && storageType !== 'postgres')) {
			throw new Error(
				`${OPS_PREFIX.STORAGE} Node requires PEER_SYNC_STORAGE=pglite or PEER_SYNC_STORAGE=postgres. Got: ${storageType ?? '(unset)'}`,
			)
		}

		const blobStore = await createBlobStore()

		if (storageType === 'postgres') {
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

		if (storageType === 'pglite' && finalDbPath) {
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

		throw new Error(
			`${OPS_PREFIX.STORAGE} Node storage requires PEER_SYNC_STORAGE=pglite (with PEER_DB_PATH or options.dbPath) or PEER_SYNC_STORAGE=postgres (with PEER_SYNC_DB_URL).`,
		)
	}

	throw new Error(`${OPS_PREFIX.STORAGE} No persistent storage configured for runtime=${runtime}.`)
}
