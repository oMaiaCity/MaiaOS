/**
 * OPFS implementation of DBTransactionInterfaceAsync.
 * Used inside OPFSClient.transaction() for batch operations.
 */

import {
	deleteFile,
	getOrCreateDir,
	listDir,
	readJSON,
	sanitizeForFilename,
	writeJSON,
} from './opfsHelpers.js'

export class OPFSTransaction {
	/**
	 * @param {FileSystemDirectoryHandle} root - OPFS db root (e.g. jazz-storage-opfs)
	 * @param {object} meta - Mutable meta ref { coValuesNextRowId, sessionsNextRowId, unsyncedNextRowId }
	 */
	constructor(root, meta) {
		this.root = root
		this.meta = meta
		this.metaModified = false
		/** Deferred signature writes - flushed after transactions, before sessions */
		this._deferredSignatureWrites = []
		/** Deferred session writes - flushed last so loads never see session before tx/sig */
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
		// Defer: write AFTER transactions/signatures so concurrent loads never see session without its data
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
		// Defer: write AFTER transactions so physical order is tx→sig→session
		this._deferredSignatureWrites.push({
			path: `signatureAfter/${sessionRowID}/${idx}.json`,
			row: { ses: sessionRowID, idx, signature },
		})
	}

	/** Flush deferred writes in order: sig → session. Transactions written immediately in addTransaction. */
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
