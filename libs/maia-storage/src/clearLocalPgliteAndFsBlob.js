/**
 * Local dev only: remove PGlite data directory and clear local filesystem blob store.
 * Does not touch Postgres, Neon, or Tigris — see clearStorageForReseed for full reset.
 *
 * @param {Object} opts
 * @param {string} opts.dbPath - Resolved absolute path to PGlite data directory
 * @param {string} opts.blobPath - Resolved absolute path to binary-bucket root
 */
import { mkdir, rm } from 'node:fs/promises'
import { LocalFsBlobStore } from './blob/local-fs.js'

export async function clearLocalPgliteAndFsBlob({ dbPath, blobPath }) {
	try {
		await rm(dbPath, { recursive: true, force: true })
	} catch (e) {
		if (e?.code !== 'ENOENT') throw e
	}
	await mkdir(dbPath, { recursive: true })
	const store = new LocalFsBlobStore(blobPath)
	await store.clear()
}
