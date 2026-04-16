/**
 * Read-only SQL inspector over the shared PGlite / Postgres `{ query, exec }` adapter shape.
 */

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>, exec: (text: string) => Promise<void> }} db
 * @param {{ timeoutMs?: number }} [options]
 */
export function createStorageInspector(db, { timeoutMs = 15000 } = {}) {
	return {
		async listTables() {
			const result = await db.query(
				`SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
			)
			const names = result.rows.map((r) => r.table_name ?? r.tableName).filter(Boolean)
			return { tables: names }
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
			const trimmed = String(sql)
				.trim()
				.replace(/;+\s*$/, '')
			if (trimmed.includes(';')) {
				throw new Error('Multiple statements are not allowed')
			}
			const started = Date.now()

			const run = async () => {
				await db.exec('BEGIN READ ONLY')
				try {
					const result = await db.query(trimmed, params)
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
