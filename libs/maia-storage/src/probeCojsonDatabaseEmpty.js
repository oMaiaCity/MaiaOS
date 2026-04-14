/**
 * One-shot probe: open storage, run migrations, check if any CoJSON data exists, close.
 * Used by sync before loadOrCreateAgentAccount so genesis seed runs only on truly empty DBs.
 */

import { SQL } from 'bun'
import { createPGliteAdapter } from './adapters/pglite.js'
import { isDatabaseEmptyFromQueryInterface, isDatabaseEmptyFromSql } from './isDatabaseEmpty.js'
import { normalizePostgresConnectionString } from './normalizePostgresUrl.js'
import { runMigrations } from './schema/postgres.js'

function createSqlDbInterface(sql) {
	return {
		query: async (text, params) => {
			const raw = await sql.unsafe(text, params ?? [])
			const rows = Array.isArray(raw) ? raw : [...raw]
			return { rows }
		},
		exec: async (text) => {
			await sql.unsafe(text)
		},
	}
}

/**
 * @param {string} connectionString
 * @returns {Promise<boolean>} true if DB has no CoJSON data rows (safe to genesis-seed)
 */
export async function probePostgresDatabaseEmpty(connectionString) {
	const normalized = normalizePostgresConnectionString(connectionString)
	const sql = new SQL(normalized, { max: 1 })
	try {
		const db = createSqlDbInterface(sql)
		await runMigrations(db)
		return await isDatabaseEmptyFromSql(sql)
	} finally {
		await sql.close()
	}
}

/**
 * @param {string} dbPath
 * @returns {Promise<boolean>}
 */
export async function probePGliteDatabaseEmpty(dbPath) {
	const client = await createPGliteAdapter(dbPath, undefined)
	try {
		return await isDatabaseEmptyFromQueryInterface(client.db)
	} finally {
		await client.db.close()
	}
}
