/**
 * Local filesystem BlobStore for development.
 * Stores blobs at {basePath}/chunks/{blake3hex}.
 * Content-addressable: identical payloads deduplicate automatically.
 *
 * @implements {import('./interface.js').BlobStore}
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BLOB_PREFIX } from './interface.js'

export class LocalFsBlobStore {
	constructor(basePath) {
		this.basePath = basePath
		this.chunksDir = join(basePath, BLOB_PREFIX)
		this._ready = mkdir(this.chunksDir, { recursive: true })
	}

	_keyToPath(key) {
		const name = key.startsWith(BLOB_PREFIX) ? key.slice(BLOB_PREFIX.length) : key
		return join(this.chunksDir, name)
	}

	async put(key, data) {
		await this._ready
		const filePath = this._keyToPath(key)
		await writeFile(filePath, data)
	}

	async get(key) {
		await this._ready
		try {
			return await readFile(this._keyToPath(key))
		} catch (e) {
			if (e?.code === 'ENOENT') return null
			throw e
		}
	}

	async has(key) {
		await this._ready
		try {
			await stat(this._keyToPath(key))
			return true
		} catch {
			return false
		}
	}
}
