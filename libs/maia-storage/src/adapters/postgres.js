/**
 * Postgres Adapter for CoJSON Storage
 *
 * Implements DBClientInterfaceAsync using node-postgres (pg).
 * Uses shared schema from ../schema/postgres.js (same as PGlite).
 * For Fly.io Managed Postgres: set PEER_STORAGE=postgres and PEER_DB_URL.
 */

import { emptyKnownState, logger } from 'cojson'
import { StorageApiAsync } from 'cojson/dist/storage/storageAsync.js'
import { DeletedCoValueDeletionStatus } from 'cojson/dist/storage/types.js'
import pg from 'pg'
import { runMigrations } from '../schema/postgres.js'

/**
 * Wrap pg.Client with query + exec for schema module compatibility
 */
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
	constructor(db) {
		this.db = db
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
			return result.rows[0]?.rowID || sessionRow.rowID
		}
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
		return result.rows[0].rowID || result.rows[0].rowid
	}

	async addTransaction(sessionRowID, idx, newTransaction) {
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
 */
class PostgresClient {
	constructor(client) {
		this.client = client
		this.db = client
	}

	async getCoValue(coValueId) {
		const result = await this.db.query('SELECT * FROM coValues WHERE id = $1', [coValueId])
		if (!result.rows[0]) return undefined

		const row = result.rows[0]
		try {
			const header = typeof row.header === 'string' ? JSON.parse(row.header) : row.header
			return {
				rowID: row.rowID || row.rowid,
				id: row.id,
				header,
			}
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

		if (result.rows[0]) return result.rows[0].rowID || result.rows[0].rowid

		const existing = await this.db.query('SELECT "rowID" FROM coValues WHERE id = $1', [id])
		return existing.rows[0]?.rowID || existing.rows[0]?.rowid
	}

	async getAllCoValuesWaitingForDelete() {
		const result = await this.db.query('SELECT "coValueID" FROM deletedCoValues WHERE status = $1', [
			DeletedCoValueDeletionStatus.Pending,
		])
		return result.rows.map((r) => r.coValueID || r.covalueid)
	}

	async getCoValueSessions(coValueRowId) {
		const result = await this.db.query('SELECT * FROM sessions WHERE "coValue" = $1', [coValueRowId])
		return result.rows.map((row) => ({
			rowID: row.rowID || row.rowid,
			coValue: row.coValue || row.covalue,
			sessionID: row.sessionID || row.sessionid,
			lastIdx: row.lastIdx || row.lastidx,
			lastSignature: row.lastSignature || row.lastsignature,
			bytesSinceLastSignature: row.bytesSinceLastSignature || row.bytessincelastsignature,
		}))
	}

	async getNewTransactionInSession(sessionRowId, fromIdx, toIdx) {
		const result = await this.db.query(
			'SELECT * FROM transactions WHERE ses = $1 AND idx >= $2 AND idx <= $3 ORDER BY idx',
			[sessionRowId, fromIdx, toIdx],
		)
		return result.rows
			.map((row) => {
				try {
					return {
						ses: row.ses,
						idx: row.idx,
						tx: typeof row.tx === 'string' ? JSON.parse(row.tx) : row.tx,
					}
				} catch (e) {
					logger.warn('Invalid JSON in transaction', { err: e })
					return null
				}
			})
			.filter(Boolean)
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
			const tx = new PostgresTransaction(this.db)
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
 * @returns {Promise<PostgresClient>}
 */
export async function createPostgresAdapter(connectionString) {
	if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
		throw new Error('[STORAGE] Postgres adapter is only available in Node.js/server environments')
	}

	const client = new pg.Client({ connectionString })
	await client.connect()

	if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
		console.log('[STORAGE] Postgres connected, running migrations...')
	}

	const db = wrapClient(client)
	await runMigrations(db)

	return new PostgresClient(client)
}

/**
 * Get Postgres storage wrapped in StorageApiAsync
 *
 * @param {string} connectionString - PEER_DB_URL from Fly MPG
 * @returns {Promise<StorageApiAsync>}
 */
export async function getPostgresStorage(connectionString) {
	const dbClient = await createPostgresAdapter(connectionString)
	const storage = new StorageApiAsync(dbClient)
	storage.enableDeletedCoValuesErasure()
	return storage
}
