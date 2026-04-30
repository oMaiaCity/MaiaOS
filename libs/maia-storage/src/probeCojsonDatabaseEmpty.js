/**
 * One-shot probe: open storage, run migrations, check if any CoJSON data exists, close.
 * Used by sync before `signIn({ type: 'secretkey', source: 'config' })` so genesis seed runs only on truly empty DBs.
 */

import { SQL } from 'bun'
import { createPGliteAdapter } from './adapters/pglite.js'
import { BUN_SQL_ADAPTER_OPTIONS, createSqlDbInterface } from './adapters/postgres.js'
import { isDatabaseEmptyFromQueryInterface, isDatabaseEmptyFromSql } from './isDatabaseEmpty.js'
import { normalizePostgresConnectionString } from './normalizePostgresUrl.js'
import { runMigrations } from './schema/postgres.js'

/**
 * @param {string} connectionString
 * @returns {Promise<boolean>} true if DB has no CoJSON data rows (safe to genesis-seed)
 */
export async function probePostgresDatabaseEmpty(connectionString) {
	const normalized = normalizePostgresConnectionString(connectionString)
	const sql = new SQL(normalized, BUN_SQL_ADAPTER_OPTIONS)
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
