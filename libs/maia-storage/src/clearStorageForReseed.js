import { SQL } from 'bun'
import { normalizePostgresConnectionString } from './normalizePostgresUrl.js'

/**
 * Clear DB and binary blob storage for reseed (sync: optional PEER_SYNC_MODE=seed force reseed).
 * Ensures a complete reset before loadOrCreateAgentAccount + seed.
 *
 * Node.js server only. Reads env: PEER_SYNC_STORAGE, PEER_DB_PATH, PEER_SYNC_DB_URL,
 * PEER_BLOB_PATH, BUCKET_NAME.
 *
 * @param {Object} [options]
 * @param {string} [options.dbPath] - PGlite db path (overrides PEER_DB_PATH)
 * @param {boolean} [options.usePostgres] - Use Postgres (PEER_SYNC_DB_URL)
 */
export async function clearStorageForReseed(options = {}) {
	if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
		throw new Error('[clearStorageForReseed] Node.js server only')
	}

	const storageType = process.env.PEER_SYNC_STORAGE || 'pglite'
	const usePostgres = options.usePostgres ?? storageType === 'postgres'
	const dbPath = options.dbPath ?? process.env.PEER_DB_PATH

	if (usePostgres) {
		const databaseUrl = process.env.PEER_SYNC_DB_URL
		if (!databaseUrl) {
			throw new Error('[clearStorageForReseed] PEER_SYNC_STORAGE=postgres requires PEER_SYNC_DB_URL')
		}
		const sql = new SQL(normalizePostgresConnectionString(databaseUrl), { max: 1 })
		try {
			await sql.unsafe(
				'TRUNCATE transactions, signatureafter, sessions, covalues, unsynced_covalues, deletedcovalues, schema_version RESTART IDENTITY CASCADE',
			)
		} catch (e) {
			if (e?.code === '42P01' || e?.message?.includes('does not exist')) {
				// Fresh DB, tables not yet created — migrations will create them
			} else {
				throw e
			}
		} finally {
			await sql.close()
		}
	} else if (dbPath) {
		const fs = await import('node:fs/promises')
		const path = await import('node:path')
		const resolvedPath = path.resolve(dbPath)
		try {
			await fs.rm(resolvedPath, { recursive: true, force: true })
		} catch (e) {
			if (e?.code !== 'ENOENT') throw e
		}
		await fs.mkdir(resolvedPath, { recursive: true })
	}

	// Clear binary blob store
	const bucketName = process.env.BUCKET_NAME
	if (bucketName) {
		const { TigrisBlobStore } = await import('./blob/tigris.js')
		const store = new TigrisBlobStore(bucketName)
		await store.clear()
	} else {
		const blobPath =
			(typeof process !== 'undefined' && process.env?.PEER_BLOB_PATH) || './binary-bucket'
		const { resolve } = await import('node:path')
		const { LocalFsBlobStore } = await import('./blob/local-fs.js')
		const store = new LocalFsBlobStore(resolve(blobPath))
		await store.clear()
	}
}
