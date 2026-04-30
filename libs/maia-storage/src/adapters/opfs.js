/**
 * OPFS (Origin Private File System) Storage Adapter — helpers, transaction, client, and entry.
 * Single module to shorten import-graph depth (was opfsHelpers → opfsTransaction → opfsClient → opfs).
 */

import {
	isStorageOpfsPerfEnabled,
	logStorageOpfsStep,
	storageOpfsLog,
} from '@MaiaOS/logs/storage-opfs'
import { StorageApiAsync } from 'cojson/dist/storage/storageAsync.js'

const opfsLog = storageOpfsLog

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
 * @param {string} id
 * @returns {string}
 */
export function sanitizeForFilename(id) {
	if (typeof id !== 'string') return ''
	return id.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9_\-$]/g, '_')
}

/**
 * Encode sessionID for unique filename.
 */
export function encodeSessionIdForFilename(sessionID) {
	if (typeof sessionID !== 'string') return 'session_'
	const bytes = new TextEncoder().encode(sessionID)
	let binary = ''
	for (let i = 0; i < bytes.length; i++) binary += String.fromCodePoint(bytes[i])
	const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64')
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Dir cache: root -> path -> handle. */
const _dirCache = new Map()

/**
 * Get or create a directory at path (slash-separated).
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path
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

export async function writeJSON(root, path, obj) {
	const parts = path.split('/').filter(Boolean)
	if (parts.length === 0) return
	const fileName = parts.pop()
	const dirPath = parts.join('/')
	const doWrite = async () => {
		const dir = dirPath ? await getOrCreateDir(root, dirPath) : root
		const handle = await dir.getFileHandle(fileName, { create: true })
		const writable = await handle.createWritable()
		await writable.write(JSON.stringify(obj))
		await writable.close()
	}
	try {
		await doWrite()
	} catch (e) {
		if (e?.name === 'NotFoundError') {
			_dirCache.delete(root)
			await doWrite()
			return
		}
		throw e
	}
}

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
			opfsLog.warn('[OPFS] removeEntry skipped (NoModificationAllowedError):', path)
			return
		}
		throw e
	}
}

export async function listDir(dir) {
	const names = []
	for await (const [name] of dir.entries()) {
		names.push(name)
	}
	return names
}

/**
 * OPFS transaction for batch ops inside OPFSClient.transaction().
 * Deferred writes: signatures, then sessions (see flushDeferredWrites).
 */
export class OPFSTransaction {
	/**
	 * @param {FileSystemDirectoryHandle} root
	 * @param {object} meta
	 */
	constructor(root, meta) {
		this.root = root
		this.meta = meta
		this.metaModified = false
		this._deferredSignatureWrites = []
		this._deferredSessionWrites = []
	}

	async getSingleCoValueSession(coValueRowId, sessionID) {
		const safeId = sanitizeForFilename(sessionID)
		return readJSON(this.root, `sessions/${coValueRowId}/${safeId}.json`)
	}

	async markCoValueAsDeleted(id) {
		const safeId = sanitizeForFilename(id)
		await writeJSON(this.root, `deletedCoValues/${safeId}.json`, {
			coValueID: id,
			status: 'pending',
		})
	}

	async addSessionUpdate({ sessionUpdate, sessionRow }) {
		const coValueRowId = sessionUpdate.coValue
		const sessionID = sessionUpdate.sessionID
		const safeId = sanitizeForFilename(sessionID)
		let rowID = sessionRow?.rowID
		if (rowID == null) {
			rowID = this.meta.sessionsNextRowId++
			this.metaModified = true
		}
		const row = { rowID, ...sessionUpdate }
		this._deferredSessionWrites.push({ path: `sessions/${coValueRowId}/${safeId}.json`, row })
		return rowID
	}

	async addTransaction(sessionRowID, idx, newTransaction) {
		await writeJSON(this.root, `transactions/${sessionRowID}/${idx}.json`, {
			ses: sessionRowID,
			idx,
			tx: newTransaction,
		})
	}

	async addSignatureAfter({ sessionRowID, idx, signature }) {
		this._deferredSignatureWrites.push({
			path: `signatureAfter/${sessionRowID}/${idx}.json`,
			row: { ses: sessionRowID, idx, signature },
		})
	}

	async flushDeferredWrites() {
		for (const { path, row } of this._deferredSignatureWrites) {
			await writeJSON(this.root, path, row)
		}
		this._deferredSignatureWrites = []
		for (const { path, row } of this._deferredSessionWrites) {
			await writeJSON(this.root, path, row)
		}
		this._deferredSessionWrites = []
	}

	async getUnsyncedCoValueRecord(coValueId, peerId) {
		const safeCo = sanitizeForFilename(coValueId)
		const safePeer = sanitizeForFilename(peerId)
		return readJSON(this.root, `unsyncedCoValues/${safeCo}/${safePeer}.json`)
	}

	async getAllUnsyncedCoValueRecords(coValueId) {
		const safeCo = sanitizeForFilename(coValueId)
		const dir = await getOrCreateDir(this.root, `unsyncedCoValues/${safeCo}`)
		const names = await listDir(dir)
		const records = []
		for (const name of names) {
			if (name.startsWith('_')) continue
			const r = await readJSON(this.root, `unsyncedCoValues/${safeCo}/${name}`)
			if (r) records.push(r)
		}
		return records
	}

	async deleteUnsyncedCoValueRecord(rowID) {
		const loc = await readJSON(this.root, `unsyncedCoValues/_byRowId/${rowID}.json`)
		if (!loc) return
		const safeCo = sanitizeForFilename(loc.coValueId)
		const safePeer = sanitizeForFilename(loc.peerId)
		await deleteFile(this.root, `unsyncedCoValues/${safeCo}/${safePeer}.json`)
		await deleteFile(this.root, `unsyncedCoValues/_byRowId/${rowID}.json`)
	}

	async putUnsyncedCoValueRecord(record) {
		const { coValueId, peerId } = record
		let rowID = record.rowID
		const safeCo = sanitizeForFilename(coValueId)
		const safePeer = sanitizeForFilename(peerId)
		const path = `unsyncedCoValues/${safeCo}/${safePeer}.json`
		if (rowID == null) {
			rowID = this.meta.unsyncedNextRowId++
			this.metaModified = true
			await writeJSON(this.root, `unsyncedCoValues/_byRowId/${rowID}.json`, {
				coValueId,
				peerId,
			})
		}
		await writeJSON(this.root, path, { rowID, coValueId, peerId })
	}

	async deleteCoValueContent(coValue) {
		const coValueRowID = coValue.rowID
		const sessionsDir = await getOrCreateDir(this.root, `sessions/${coValueRowID}`)
		const names = await listDir(sessionsDir)
		for (const name of names) {
			if (!name.endsWith('.json')) continue
			const s = await readJSON(this.root, `sessions/${coValueRowID}/${name}`)
			if (s && !s.sessionID?.endsWith?.('$')) {
				await deleteFile(this.root, `sessions/${coValueRowID}/${name}`)
				const txDir = await getOrCreateDir(this.root, `transactions/${s.rowID}`)
				const txNames = await listDir(txDir)
				for (const n of txNames) {
					if (n.endsWith('.json')) await deleteFile(this.root, `transactions/${s.rowID}/${n}`)
				}
				const sigDir = await getOrCreateDir(this.root, `signatureAfter/${s.rowID}`)
				const sigNames = await listDir(sigDir)
				for (const n of sigNames) {
					if (n.endsWith('.json')) await deleteFile(this.root, `signatureAfter/${s.rowID}/${n}`)
				}
			}
		}
		const safeId = sanitizeForFilename(coValue.id)
		await writeJSON(this.root, `deletedCoValues/${safeId}.json`, {
			coValueID: coValue.id,
			status: 'done',
		})
	}
}

const META_PATH = '_meta.json'
const STORAGE_LOCK = 'maia-opfs-storage'
/** Bump on breaking storage changes. Old-format: migration or abandon on open. */
const FORMAT_VERSION = 1
const DEFAULT_META = {
	formatVersion: FORMAT_VERSION,
	coValuesNextRowId: 1,
	sessionsNextRowId: 1,
	unsyncedNextRowId: 1,
}

/**
 * OPFS implementation of DBClientInterfaceAsync (CoJSON persistence).
 * Web Locks serialize meta-modifying ops across tabs (avoids rowID races → InvalidSignature).
 */
export class OPFSClient {
	/**
	 * @param {FileSystemDirectoryHandle} root - OPFS db root (e.g. jazz-storage-opfs)
	 */
	constructor(root) {
		this.root = root
		/** Cached meta — avoids repeated readJSON(_meta). */
		this._metaCache = null
	}

	/** Serialize meta-modifying ops across tabs. */
	async _withLock(fn) {
		if (typeof navigator?.locks?.request === 'function') {
			return navigator.locks.request(STORAGE_LOCK, fn)
		}
		return fn()
	}

	async _loadMeta() {
		if (this._metaCache) return this._metaCache
		const m = await readJSON(this.root, META_PATH)
		if (!m) {
			const meta = { ...DEFAULT_META }
			await writeJSON(this.root, META_PATH, meta)
			this._metaCache = meta
			return meta
		}
		const stored = m.formatVersion ?? m.version ?? 0
		if (stored > FORMAT_VERSION) {
			throw new Error(
				`[OPFS] Storage format ${stored} not supported (max ${FORMAT_VERSION}). ` +
					'Migration not yet implemented.',
			)
		}
		if (stored < FORMAT_VERSION) {
			opfsLog.warn(`[OPFS] Stored format ${stored} < ${FORMAT_VERSION}, proceeding with existing data`)
		}
		this._metaCache = { ...DEFAULT_META, ...m }
		return this._metaCache
	}

	async _saveMeta(meta) {
		this._metaCache = meta
		await writeJSON(this.root, META_PATH, meta)
	}

	async getCoValue(coValueId) {
		const safeId = sanitizeForFilename(coValueId)
		return readJSON(this.root, `coValues/${safeId}.json`)
	}

	async upsertCoValue(id, header) {
		const t0 = isStorageOpfsPerfEnabled() ? performance.now() : 0
		if (!header) {
			const row = await this.getCoValue(id)
			return row?.rowID
		}
		const safeId = sanitizeForFilename(id)
		const existing = await readJSON(this.root, `coValues/${safeId}.json`)
		let rowID = existing?.rowID
		if (rowID == null) {
			rowID = await this._withLock(async () => {
				const meta = await this._loadMeta()
				const allocated = meta.coValuesNextRowId++
				await this._saveMeta(meta)
				return allocated
			})
		}
		await writeJSON(this.root, `coValues/${safeId}.json`, {
			rowID,
			id,
			header,
		})
		logStorageOpfsStep('upsertCoValue', Math.round((performance.now() - t0) * 100) / 100, {
			id: id?.slice(0, 16),
		})
		return rowID
	}

	async getAllCoValuesWaitingForDelete() {
		const dir = await getOrCreateDir(this.root, 'deletedCoValues')
		const names = await listDir(dir)
		const ids = []
		for (const name of names) {
			if (!name.endsWith('.json')) continue
			const r = await readJSON(this.root, `deletedCoValues/${name}`)
			if (r?.status === 'pending') ids.push(r.coValueID)
		}
		return ids
	}

	async getCoValueSessions(coValueRowId) {
		const dir = await getOrCreateDir(this.root, `sessions/${coValueRowId}`)
		const names = await listDir(dir)
		const sessions = []
		for (const name of names) {
			if (!name.endsWith('.json')) continue
			const s = await readJSON(this.root, `sessions/${coValueRowId}/${name}`)
			if (s) sessions.push(s)
		}
		return sessions
	}

	async getNewTransactionInSession(sessionRowId, fromIdx, toIdx) {
		const dir = await getOrCreateDir(this.root, `transactions/${sessionRowId}`)
		const names = await listDir(dir)
		const rows = []
		for (const name of names) {
			if (!name.endsWith('.json')) continue
			const idx = parseInt(name.slice(0, -5), 10)
			if (Number.isNaN(idx) || idx < fromIdx || idx > toIdx) continue
			const r = await readJSON(this.root, `transactions/${sessionRowId}/${name}`)
			if (r) rows.push(r)
		}
		rows.sort((a, b) => a.idx - b.idx)
		return rows
	}

	async getSignatures(sessionRowId, firstNewTxIdx) {
		const dir = await getOrCreateDir(this.root, `signatureAfter/${sessionRowId}`)
		const names = await listDir(dir)
		const rows = []
		for (const name of names) {
			if (!name.endsWith('.json')) continue
			const idx = parseInt(name.slice(0, -5), 10)
			if (Number.isNaN(idx) || idx < firstNewTxIdx) continue
			const r = await readJSON(this.root, `signatureAfter/${sessionRowId}/${name}`)
			if (r) rows.push(r)
		}
		rows.sort((a, b) => a.idx - b.idx)
		return rows
	}

	async transaction(callback, _storeNames) {
		const t0 = isStorageOpfsPerfEnabled() ? performance.now() : 0
		await this._withLock(async () => {
			const meta = await this._loadMeta()
			const tx = new OPFSTransaction(this.root, meta)
			await callback(tx)
			await tx.flushDeferredWrites()
			if (tx.metaModified) await this._saveMeta(meta)
		})
		logStorageOpfsStep('transaction', Math.round((performance.now() - t0) * 100) / 100)
	}

	async trackCoValuesSyncState(updates) {
		if (updates.length === 0) return
		await this.transaction(async (tx) => {
			for (const update of updates) {
				const record = await tx.getUnsyncedCoValueRecord(update.id, update.peerId)
				if (update.synced) {
					if (record) await tx.deleteUnsyncedCoValueRecord(record.rowID)
				} else {
					await tx.putUnsyncedCoValueRecord(
						record
							? { rowID: record.rowID, coValueId: update.id, peerId: update.peerId }
							: { coValueId: update.id, peerId: update.peerId },
					)
				}
			}
		})
	}

	async getUnsyncedCoValueIDs() {
		const dir = await getOrCreateDir(this.root, 'unsyncedCoValues')
		const names = await listDir(dir)
		const ids = new Set()
		for (const name of names) {
			if (name.startsWith('_')) continue
			const subDir = await getOrCreateDir(this.root, `unsyncedCoValues/${name}`)
			const subNames = await listDir(subDir)
			for (const sub of subNames) {
				if (sub.startsWith('_') || !sub.endsWith('.json')) continue
				const r = await readJSON(this.root, `unsyncedCoValues/${name}/${sub}`)
				if (r?.coValueId) ids.add(r.coValueId)
			}
		}
		return [...ids]
	}

	async stopTrackingSyncState(id) {
		await this.transaction(async (tx) => {
			const records = await tx.getAllUnsyncedCoValueRecords(id)
			for (const record of records) {
				await tx.deleteUnsyncedCoValueRecord(record.rowID)
			}
		})
	}

	async eraseCoValueButKeepTombstone(coValueID) {
		const coValue = await this.getCoValue(coValueID)
		if (!coValue) {
			opfsLog.warn(`[OPFS] CoValue ${coValueID} not found, skipping deletion`)
			return
		}
		await this.transaction((tx) => tx.deleteCoValueContent(coValue))
	}

	async getCoValueKnownState(coValueId) {
		const coValueRow = await this.getCoValue(coValueId)
		if (!coValueRow) return undefined
		const sessions = await this.getCoValueSessions(coValueRow.rowID)
		const knownState = {
			id: coValueId,
			header: true,
			sessions: {},
		}
		for (const s of sessions) {
			knownState.sessions[s.sessionID] = s.lastIdx
		}
		return knownState
	}
}

/**
 * Check if OPFS is available in the current browser.
 * @returns {boolean}
 */
export function isOPFSAvailableAdapter() {
	return isOPFSAvailable()
}

/**
 * Get OPFS storage for CoValue persistence.
 * @param {string} [dbName]
 * @returns {Promise<StorageAPI | undefined>}
 */
export async function getOPFSStorageAdapter(dbName = DEFAULT_DB_NAME) {
	try {
		if (!isOPFSAvailable()) return undefined
		const root = await getOPFSRoot(dbName)
		const client = new OPFSClient(root)
		return new StorageApiAsync(client)
	} catch {
		return undefined
	}
}
