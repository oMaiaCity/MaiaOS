/**
 * Read-only SQL inspector over the shared PGlite / Postgres `{ query, exec }` adapter shape.
 */

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/** Max rows returned for POST .../query (server-enforced). */
export const STORAGE_INSPECTOR_MAX_QUERY_ROWS = 1000
/** Default page size for GET .../tables. */
export const STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE = 100
/** Max page size for GET .../tables. */
export const STORAGE_INSPECTOR_MAX_TABLE_PAGE = 500

/**
 * @param {string} sql
 * @param {number} maxRows
 * @returns {string}
 */
function applySqlMaxRows(sql, maxRows) {
	const t = String(sql)
		.trim()
		.replace(/;+\s*$/, '')
	if (t.includes(';')) {
		throw new Error('Multiple statements are not allowed')
	}
	const tail = t.match(/\blimit\s+(\d+)\s*$/i)
	if (tail) {
		const n = Number(tail[1])
		if (Number.isNaN(n) || n < 0) {
			throw new Error('Invalid LIMIT')
		}
		if (n > maxRows) {
			throw new Error(`LIMIT ${n} exceeds maximum ${maxRows}`)
		}
		return t
	}
	return `SELECT * FROM (${t}) AS _maia_inspector_sub LIMIT ${maxRows}`
}

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>, exec: (text: string) => Promise<void> }} db
 * @param {{ timeoutMs?: number, maxQueryRows?: number }} [options]
 */
export function createStorageInspector(
	db,
	{ timeoutMs = 15000, maxQueryRows = STORAGE_INSPECTOR_MAX_QUERY_ROWS } = {},
) {
	return {
		/**
		 * @param {{ limit?: number, offset?: number }} [page]
		 */
		async listTables(page = {}) {
			let limit = Number(page.limit)
			let offset = Number(page.offset)
			if (Number.isNaN(limit) || limit < 1) limit = STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE
			if (limit > STORAGE_INSPECTOR_MAX_TABLE_PAGE) limit = STORAGE_INSPECTOR_MAX_TABLE_PAGE
			if (Number.isNaN(offset) || offset < 0) offset = 0

			const fetchLimit = limit + 1
			const result = await db.query(
				`SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name
         LIMIT $1 OFFSET $2`,
				[fetchLimit, offset],
			)
			const raw = result.rows.map((r) => r.table_name ?? r.tableName).filter(Boolean)
			const hasMore = raw.length > limit
			const names = hasMore ? raw.slice(0, limit) : raw
			return { tables: names, limit, offset, hasMore }
		},

		/**
		 * @param {string} name - Unquoted identifier (lowercase typical for CoJSON schema)
		 */
		async describeTable(name) {
			if (!SAFE_IDENT.test(name)) {
				throw new Error(`Invalid table name: ${name}`)
			}
			const result = await db.query(
				`SELECT column_name, data_type, is_nullable, ordinal_position
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
				[name],
			)
			const columns = result.rows.map((r) => ({
				name: r.column_name ?? r.columnName,
				dataType: r.data_type ?? r.dataType,
				isNullable: (r.is_nullable ?? r.isNullable) === 'YES',
				ordinalPosition: r.ordinal_position ?? r.ordinalPosition,
			}))
			return { columns }
		},

		/**
		 * @param {string} sql
		 * @param {unknown[]} [params]
		 */
		async query(sql, params = []) {
			const cappedSql = applySqlMaxRows(sql, maxQueryRows)
			const started = Date.now()

			const run = async () => {
				await db.exec('BEGIN READ ONLY')
				try {
					const result = await db.query(cappedSql, params)
					const rows = result.rows ?? []
					const fields =
						rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null ? Object.keys(rows[0]) : []
					return {
						rows,
						fields,
						rowCount: rows.length,
						durationMs: Date.now() - started,
					}
				} finally {
					await db.exec('ROLLBACK')
				}
			}

			return await withTimeout(run(), timeoutMs)
		},
	}
}

/**
 * @template T
 * @param {Promise<T>} p
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(p, ms) {
	return new Promise((resolve, reject) => {
		const id = setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
		p.then(
			(v) => {
				clearTimeout(id)
				resolve(v)
			},
			(e) => {
				clearTimeout(id)
				reject(e)
			},
		)
	})
}
