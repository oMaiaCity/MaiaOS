/**
 * Postgres Adapter for CoJSON Storage
 *
 * Implements DBClientInterfaceAsync using node-postgres (pg).
 * Uses shared schema from ../schema/postgres.js (same as PGlite).
 * For Fly.io Managed Postgres: set PEER_SYNC_STORAGE=postgres and PEER_SYNC_DB_URL.
 *
 * Binary CoValue offloading: when a BlobStore is provided, transaction payloads for
 * binary CoValues (header.meta.type === 'binary') are stored in the blob store instead
 * of PG. A _blobRef JSON object replaces the raw payload in the transactions table.
 */

import { createOpsLogger, OPS_PREFIX } from '@MaiaOS/logs'
import { emptyKnownState, logger } from 'cojson'
import { StorageApiAsync } from 'cojson/dist/storage/storageAsync.js'
import { DeletedCoValueDeletionStatus } from 'cojson/dist/storage/types.js'
import pg from 'pg'
import { runMigrations } from '../schema/postgres.js'

const opsStor = createOpsLogger('STORAGE')

function wrapClient(client) {
	return {
		query: (sql, params) => client.query(sql, params),
		exec: (sql) => client.query(sql),
	}
}

/**
 * Postgres Transaction Interface
 */
class PostgresTransaction {
	/** @param {object} db @param {PostgresClient} client */
	constructor(db, client) {
		this.db = db
		this._client = client
	}

	async getSingleCoValueSession(coValueRowId, sessionID) {
		const result = await this.db.query(
			'SELECT * FROM sessions WHERE "coValue" = $1 AND "sessionID" = $2',
			[coValueRowId, sessionID],
		)
		const row = result.rows[0]
		if (!row) return undefined

		return {
			rowID: row.rowID || row.rowid,
			coValue: row.coValue || row.covalue,
			sessionID: row.sessionID || row.sessionid,
			lastIdx: row.lastIdx || row.lastidx,
			lastSignature: row.lastSignature || row.lastsignature,
			bytesSinceLastSignature: row.bytesSinceLastSignature || row.bytessincelastsignature,
		}
	}

	async markCoValueAsDeleted(id) {
		await this.db.query(
			'INSERT INTO deletedCoValues (coValueID, status) VALUES ($1, $2) ON CONFLICT (coValueID) DO NOTHING',
			[id, DeletedCoValueDeletionStatus.Pending],
		)
	}

	async addSessionUpdate({ sessionUpdate, sessionRow }) {
		let sessionRowID
		if (sessionRow) {
			const result = await this.db.query(
				`UPDATE sessions 
         SET "lastIdx" = $1, "lastSignature" = $2, "bytesSinceLastSignature" = $3
         WHERE "rowID" = $4
         RETURNING "rowID"`,
				[
					sessionUpdate.lastIdx,
					sessionUpdate.lastSignature,
					sessionUpdate.bytesSinceLastSignature,
					sessionRow.rowID,
				],
			)
			sessionRowID = result.rows[0]?.rowID || sessionRow.rowID
		} else {
			const result = await this.db.query(
				`INSERT INTO sessions ("coValue", "sessionID", "lastIdx", "lastSignature", "bytesSinceLastSignature") 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("sessionID", "coValue") 
       DO UPDATE SET "lastIdx" = EXCLUDED."lastIdx", "lastSignature" = EXCLUDED."lastSignature", "bytesSinceLastSignature" = EXCLUDED."bytesSinceLastSignature"
       RETURNING "rowID"`,
				[
					sessionUpdate.coValue,
					sessionUpdate.sessionID,
					sessionUpdate.lastIdx,
					sessionUpdate.lastSignature,
					sessionUpdate.bytesSinceLastSignature,
				],
			)
			if (!result.rows[0]) throw new Error('Failed to add session update')
			sessionRowID = result.rows[0].rowID || result.rows[0].rowid
		}

		if (this._client._binaryCoValueRowIDs.has(sessionUpdate.coValue)) {
			this._client._binarySessionRowIDs.add(sessionRowID)
		}

		return sessionRowID
	}

	async addTransaction(sessionRowID, idx, newTransaction) {
		const blobStore = this._client._blobStore
		if (blobStore && this._client._binarySessionRowIDs.has(sessionRowID)) {
			const payload = JSON.stringify(newTransaction)
			const { blobKeyFromPayload, blobHashFromPayload } = await import('../blob/interface.js')
			const blobKey = blobKeyFromPayload(payload)
			const blobHash = blobHashFromPayload(payload)
			await blobStore.put(blobKey, new TextEncoder().encode(payload))
			const ref = { _blobRef: blobHash, _blobSize: payload.length, _blobKey: blobKey }
			await this.db.query('INSERT INTO transactions (ses, idx, tx) VALUES ($1, $2, $3)', [
				sessionRowID,
				idx,
				JSON.stringify(ref),
			])
			return
		}
		await this.db.query('INSERT INTO transactions (ses, idx, tx) VALUES ($1, $2, $3)', [
			sessionRowID,
			idx,
			JSON.stringify(newTransaction),
		])
	}

	async addSignatureAfter({ sessionRowID, idx, signature }) {
		await this.db.query('INSERT INTO signatureAfter (ses, idx, signature) VALUES ($1, $2, $3)', [
			sessionRowID,
			idx,
			signature,
		])
	}
}

/**
 * Postgres Client implementing DBClientInterfaceAsync
 *
 * @param {object} client - pg.Client instance
 * @param {import('../blob/interface.js').BlobStore} [blobStore] - optional blob store for binary offloading
 */
class PostgresClient {
	constructor(client, blobStore) {
		this.client = client
		this.db = client
		/** @type {import('../blob/interface.js').BlobStore | null} */
		this._blobStore = blobStore || null
		this._binaryCoValueRowIDs = new Set()
		this._binarySessionRowIDs = new Set()
	}

	async getCoValue(coValueId) {
		const result = await this.db.query('SELECT * FROM coValues WHERE id = $1', [coValueId])
		if (!result.rows[0]) return undefined

		const row = result.rows[0]
		try {
			const header = typeof row.header === 'string' ? JSON.parse(row.header) : row.header
			const rowID = row.rowID || row.rowid

			if (this._blobStore && header?.meta?.type === 'binary') {
				this._binaryCoValueRowIDs.add(rowID)
			}

			return { rowID, id: row.id, header }
		} catch (e) {
			logger.warn(`Invalid JSON in header: ${row.header}`, { id: coValueId, err: e })
			return undefined
		}
	}

	async upsertCoValue(id, header) {
		if (!header) {
			const result = await this.db.query('SELECT "rowID" FROM coValues WHERE id = $1', [id])
			return result.rows[0]?.rowID || result.rows[0]?.rowid
		}

		const result = await this.db.query(
			`INSERT INTO coValues (id, header) VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING
       RETURNING "rowID"`,
			[id, JSON.stringify(header)],
		)

		let rowID
		if (result.rows[0]) {
			rowID = result.rows[0].rowID || result.rows[0].rowid
		} else {
			const existing = await this.db.query('SELECT "rowID" FROM coValues WHERE id = $1', [id])
			rowID = existing.rows[0]?.rowID || existing.rows[0]?.rowid
		}

		if (this._blobStore && header?.meta?.type === 'binary') {
			this._binaryCoValueRowIDs.add(rowID)
		}

		return rowID
	}

	async getAllCoValuesWaitingForDelete() {
		const result = await this.db.query('SELECT "coValueID" FROM deletedCoValues WHERE status = $1', [
			DeletedCoValueDeletionStatus.Pending,
		])
		return result.rows.map((r) => r.coValueID || r.covalueid)
	}

	async getCoValueSessions(coValueRowId) {
		const result = await this.db.query('SELECT * FROM sessions WHERE "coValue" = $1', [coValueRowId])
		const isBinary = this._binaryCoValueRowIDs.has(coValueRowId)
		return result.rows.map((row) => {
			const rowID = row.rowID || row.rowid
			if (isBinary) this._binarySessionRowIDs.add(rowID)
			return {
				rowID,
				coValue: row.coValue || row.covalue,
				sessionID: row.sessionID || row.sessionid,
				lastIdx: row.lastIdx || row.lastidx,
				lastSignature: row.lastSignature || row.lastsignature,
				bytesSinceLastSignature: row.bytesSinceLastSignature || row.bytessincelastsignature,
			}
		})
	}

	async getNewTransactionInSession(sessionRowId, fromIdx, toIdx) {
		const result = await this.db.query(
			'SELECT * FROM transactions WHERE ses = $1 AND idx >= $2 AND idx <= $3 ORDER BY idx',
			[sessionRowId, fromIdx, toIdx],
		)
		const rows = []
		for (const row of result.rows) {
			try {
				let tx = typeof row.tx === 'string' ? JSON.parse(row.tx) : row.tx

				if (this._blobStore && tx?._blobKey) {
					const data = await this._blobStore.get(tx._blobKey)
					if (!data) {
						logger.warn('Blob not found for ref', { ref: tx._blobKey, ses: row.ses, idx: row.idx })
						continue
					}
					tx = JSON.parse(new TextDecoder().decode(data))
				}

				rows.push({ ses: row.ses, idx: row.idx, tx })
			} catch (e) {
				logger.warn('Invalid JSON in transaction', { err: e })
			}
		}
		return rows
	}

	async getSignatures(sessionRowId, firstNewTxIdx) {
		const result = await this.db.query(
			'SELECT * FROM signatureAfter WHERE ses = $1 AND idx >= $2 ORDER BY idx',
			[sessionRowId, firstNewTxIdx],
		)
		return result.rows.map((row) => ({
			ses: row.ses,
			idx: row.idx,
			signature: row.signature,
		}))
	}

	async transaction(callback) {
		await this.db.query('BEGIN')
		try {
			const tx = new PostgresTransaction(this.db, this)
			await callback(tx)
			await this.db.query('COMMIT')
		} catch (e) {
			await this.db.query('ROLLBACK')
			throw e
		}
	}

	async trackCoValuesSyncState(updates) {
		for (const update of updates) {
			if (update.synced) {
				await this.db.query(
					'DELETE FROM unsynced_covalues WHERE "co_value_id" = $1 AND "peer_id" = $2',
					[update.id, update.peerId],
				)
			} else {
				await this.db.query(
					'INSERT INTO unsynced_covalues ("co_value_id", "peer_id") VALUES ($1, $2) ON CONFLICT ("co_value_id", "peer_id") DO NOTHING',
					[update.id, update.peerId],
				)
			}
		}
	}

	async getUnsyncedCoValueIDs() {
		const result = await this.db.query('SELECT DISTINCT "co_value_id" FROM unsynced_covalues')
		return result.rows.map((row) => row.co_value_id)
	}

	async stopTrackingSyncState(id) {
		await this.db.query('DELETE FROM unsynced_covalues WHERE "co_value_id" = $1', [id])
	}

	async eraseCoValueButKeepTombstone(coValueID) {
		const coValueRow = await this.db.query('SELECT "rowID" FROM coValues WHERE id = $1', [coValueID])
		if (!coValueRow.rows[0]) {
			logger.warn(`CoValue ${coValueID} not found, skipping deletion`)
			return
		}
		const rowId = coValueRow.rows[0].rowID || coValueRow.rows[0].rowid

		await this.transaction(async () => {
			await this.db.query(
				`DELETE FROM transactions
         WHERE ses IN (
           SELECT "rowID" FROM sessions
           WHERE "coValue" = $1 AND "sessionID" NOT LIKE '%$'
         )`,
				[rowId],
			)
			await this.db.query(
				`DELETE FROM signatureAfter
         WHERE ses IN (
           SELECT "rowID" FROM sessions
           WHERE "coValue" = $1 AND "sessionID" NOT LIKE '%$'
         )`,
				[rowId],
			)
			await this.db.query(
				`DELETE FROM sessions
         WHERE "coValue" = $1 AND "sessionID" NOT LIKE '%$'`,
				[rowId],
			)
			await this.db.query(
				`INSERT INTO deletedCoValues ("coValueID", status) VALUES ($1, $2)
         ON CONFLICT ("coValueID") DO UPDATE SET status = $2`,
				[coValueID, DeletedCoValueDeletionStatus.Done],
			)
		})
	}

	async getCoValueKnownState(coValueId) {
		const coValueRow = await this.db.query('SELECT "rowID" FROM coValues WHERE id = $1', [coValueId])
		if (!coValueRow.rows[0]) return undefined

		const rowId = coValueRow.rows[0].rowID || coValueRow.rows[0].rowid
		const sessions = await this.db.query(
			'SELECT "sessionID", "lastIdx" FROM sessions WHERE "coValue" = $1',
			[rowId],
		)

		const knownState = emptyKnownState(coValueId)
		knownState.header = true

		for (const session of sessions.rows) {
			const sessionID = session.sessionID || session.sessionid
			const lastIdx = session.lastIdx || session.lastidx
			knownState.sessions[sessionID] = lastIdx
		}

		return knownState
	}
}

/**
 * Create Postgres adapter with migrations
 *
 * @param {string} connectionString - postgres://user:pass@host:port/db
 * @param {import('../blob/interface.js').BlobStore} [blobStore] - optional blob store for binary offloading
 * @returns {Promise<PostgresClient>}
 */
export async function createPostgresAdapter(connectionString, blobStore) {
	if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
		throw new Error(
			`${OPS_PREFIX.STORAGE} Postgres adapter is only available in Node.js/server environments`,
		)
	}

	const client = new pg.Client({ connectionString })
	await client.connect()

	if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
		opsStor.log('Postgres connected, running migrations...')
	}

	const db = wrapClient(client)
	await runMigrations(db)

	return new PostgresClient(client, blobStore)
}

/**
 * Get Postgres storage wrapped in StorageApiAsync
 *
 * @param {string} connectionString - PEER_SYNC_DB_URL from Fly MPG or Neon
 * @param {import('../blob/interface.js').BlobStore} [blobStore] - optional blob store for binary offloading
 * @returns {Promise<StorageApiAsync>}
 */
export async function getPostgresStorage(connectionString, blobStore) {
	const dbClient = await createPostgresAdapter(connectionString, blobStore)
	const storage = new StorageApiAsync(dbClient)
	storage.enableDeletedCoValuesErasure()
	return storage
}
