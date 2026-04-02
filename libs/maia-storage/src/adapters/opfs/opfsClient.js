/**
 * OPFS implementation of DBClientInterfaceAsync.
 * Provides CoJSON storage backend using Origin Private File System.
 *
 * Root cause fix for InvalidSignature: OPFS has no atomic transactions.
 * We use Web Locks API to serialize all meta-modifying operations across tabs,
 * preventing race conditions that corrupt session rowIDs and cause signature mismatches.
 */

import { isStorageOpfsPerfEnabled, logStorageOpfsStep } from '@MaiaOS/logs'
import { getOrCreateDir, listDir, readJSON, sanitizeForFilename, writeJSON } from './opfsHelpers.js'
import { OPFSTransaction } from './opfsTransaction.js'

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

export class OPFSClient {
	/**
	 * @param {FileSystemDirectoryHandle} root - OPFS db root (e.g. jazz-storage-opfs)
	 */
	constructor(root) {
		this.root = root
		/** Cached meta - avoids 26x readJSON(_meta) per binary upload. */
		this._metaCache = null
	}

	/** Serialize meta-modifying ops across tabs. Prevents rowID corruption → InvalidSignature. */
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
			if (typeof console?.warn === 'function') {
				console.warn(
					`[OPFS] Stored format ${stored} < ${FORMAT_VERSION}, proceeding with existing data`,
				)
			}
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
			console.warn(`[OPFS] CoValue ${coValueID} not found, skipping deletion`)
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
