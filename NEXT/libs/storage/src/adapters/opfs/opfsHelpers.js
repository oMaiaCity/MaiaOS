/**
 * OPFS (Origin Private File System) helper functions for CoJSON storage adapter.
 * Uses async File System API - works in main thread.
 */

/** v1: Batched transaction format, meta cache, dir cache. Fresh start. */
export const DEFAULT_DB_NAME = 'cojson-storage-opfs-v1'

/**
 * Check if OPFS is available (navigator.storage.getDirectory exists).
 * @returns {boolean}
 */
export function isOPFSAvailable() {
	return (
		typeof navigator !== 'undefined' &&
		navigator.storage != null &&
		typeof navigator.storage.getDirectory === 'function'
	)
}

/**
 * Get OPFS root directory handle. Creates dbName subdir for isolation.
 * @param {string} [dbName]
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function getOPFSRoot(dbName = DEFAULT_DB_NAME) {
	if (!isOPFSAvailable()) {
		throw new Error('[OPFS] navigator.storage.getDirectory is not available')
	}
	const root = await navigator.storage.getDirectory()
	return getOrCreateDir(root, dbName)
}

/**
 * Sanitize id (coId, peerId) for safe use as filename.
 * Replaces / and \ with _, keeps alphanumeric, _, -, $
 * @param {string} id
 * @returns {string}
 */
export function sanitizeForFilename(id) {
	if (typeof id !== 'string') return ''
	return id.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9_\-$]/g, '_')
}

/**
 * Encode sessionID for unique filename. Prevents collision: sanitizeForFilename
 * collapses different IDs (e.g. "a.b" and "a_b" both → "a_b") causing overwrite → InvalidSignature.
 * Uses base64url for filesystem-safe unique encoding.
 */
export function encodeSessionIdForFilename(sessionID) {
	if (typeof sessionID !== 'string') return 'session_'
	const bytes = new TextEncoder().encode(sessionID)
	let binary = ''
	for (let i = 0; i < bytes.length; i++) binary += String.fromCodePoint(bytes[i])
	const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64')
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Dir cache: root -> path -> handle. Reduces repeated getDirectoryHandle for same path. */
const _dirCache = new Map()

/**
 * Get or create a directory at path (slash-separated). Creates parents as needed.
 * Uses cache to avoid repeated traversal for hot paths (e.g. transactions/42).
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path - e.g. "sessions/123" or "coValues"
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function getOrCreateDir(root, path) {
	if (!path) return root
	let cache = _dirCache.get(root)
	if (!cache) {
		cache = new Map()
		_dirCache.set(root, cache)
	}
	const cached = cache.get(path)
	if (cached) return cached
	const parts = path.split('/').filter(Boolean)
	let current = root
	for (const part of parts) {
		current = await current.getDirectoryHandle(part, { create: true })
	}
	cache.set(path, current)
	return current
}

/**
 * Read a JSON file. Returns undefined if file does not exist.
 * @param {FileSystemDirectoryHandle} root - base dir (e.g. jazz-storage-opfs)
 * @param {string} path - relative path, e.g. "coValues/co_zXXX.json"
 * @returns {Promise<any | undefined>}
 */
async function readJSONOnce(root, path) {
	const parts = path.split('/').filter(Boolean)
	if (parts.length === 0) return undefined
	const fileName = parts.pop()
	const dirPath = parts.join('/')
	const dir = dirPath ? await getOrCreateDir(root, dirPath) : root
	const handle = await dir.getFileHandle(fileName, { create: false })
	const file = await handle.getFile()
	const text = await file.text()
	return text ? JSON.parse(text) : undefined
}

/**
 * Read a JSON file. Returns undefined if file does not exist.
 * Retries once on NotReadableError (OPFS can throw when reading during concurrent write).
 */
export async function readJSON(root, path) {
	try {
		return await readJSONOnce(root, path)
	} catch (e) {
		if (e?.name === 'NotFoundError') return undefined
		if (e?.name === 'NotReadableError') {
			await new Promise((r) => setTimeout(r, 50))
			try {
				return await readJSONOnce(root, path)
			} catch (retryErr) {
				if (retryErr?.name === 'NotFoundError') return undefined
				throw retryErr
			}
		}
		throw e
	}
}

/**
 * Write a JSON file. Creates parent dirs as needed.
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path - e.g. "coValues/co_zXXX.json"
 * @param {any} obj
 * @returns {Promise<void>}
 */
export async function writeJSON(root, path, obj) {
	const parts = path.split('/').filter(Boolean)
	if (parts.length === 0) return
	const fileName = parts.pop()
	const dirPath = parts.join('/')
	const dir = dirPath ? await getOrCreateDir(root, dirPath) : root
	const handle = await dir.getFileHandle(fileName, { create: true })
	const writable = await handle.createWritable()
	await writable.write(JSON.stringify(obj))
	await writable.close()
}

/**
 * Delete a file. No-op if file does not exist.
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function deleteFile(root, path) {
	try {
		const parts = path.split('/').filter(Boolean)
		if (parts.length === 0) return
		const fileName = parts.pop()
		const dirPath = parts.join('/')
		const dir = dirPath ? await getOrCreateDir(root, dirPath) : root
		await dir.removeEntry(fileName, { recursive: false })
	} catch (e) {
		if (e?.name === 'NotFoundError') return
		if (e?.name === 'NoModificationAllowedError') {
			// OPFS can throw when dir is read-only (e.g. during unload, some browser states)
			if (typeof console?.warn === 'function') {
				console.warn('[OPFS] removeEntry skipped (NoModificationAllowedError):', path)
			}
			return
		}
		throw e
	}
}

/**
 * List direct child names (files and dirs) of a directory.
 * @param {FileSystemDirectoryHandle} dir
 * @returns {Promise<string[]>}
 */
export async function listDir(dir) {
	const names = []
	for await (const [name] of dir.entries()) {
		names.push(name)
	}
	return names
}
