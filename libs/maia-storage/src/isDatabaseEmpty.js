/**
 * Low-level emptiness check for CoJSON persistence: any row in any data table
 * means the database is not empty (do not genesis-seed).
 * Table names are a fixed allowlist (schema/postgres.js); never user input.
 */

import { createSqlDbInterface } from './adapters/postgres.js'
import { COJSON_DATA_TABLES } from './coStorageTables.js'

/**
 * @param {import('bun').SQL} sql
 * @returns {Promise<boolean>} true if no CoJSON data rows exist
 */
export async function isDatabaseEmptyFromSql(sql) {
	const db = createSqlDbInterface(sql)
	for (const table of COJSON_DATA_TABLES) {
		try {
			const result = await db.query(`SELECT 1 FROM ${table} LIMIT 1`, [])
			if (result.rows?.length > 0) return false
		} catch {
			/* missing table or unreadable — treat as no data in that table */
		}
	}
	return true
}

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }} db
 * @returns {Promise<boolean>}
 */
export async function isDatabaseEmptyFromQueryInterface(db) {
	for (const table of COJSON_DATA_TABLES) {
		try {
			const result = await db.query(`SELECT 1 FROM ${table} LIMIT 1`)
			if (result.rows?.length > 0) return false
		} catch {
			/* missing table */
		}
	}
	return true
}
