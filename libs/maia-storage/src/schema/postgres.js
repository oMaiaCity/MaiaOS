/**
 * Shared PostgreSQL schema for CoJSON storage
 * Single source of truth for PGlite and node-postgres adapters
 *
 * db interface: { query(sql, params) => { rows }, exec(sql) => void }
 * pg adapters provide exec = (sql) => client.query(sql)
 */

export const migrations = {
	1: [
		`CREATE TABLE IF NOT EXISTS transactions (
      ses INTEGER,
      idx INTEGER,
      tx TEXT NOT NULL,
      PRIMARY KEY (ses, idx)
    );`,
		`CREATE TABLE IF NOT EXISTS sessions (
      "rowID" SERIAL PRIMARY KEY,
      "coValue" INTEGER NOT NULL,
      "sessionID" TEXT NOT NULL,
      "lastIdx" INTEGER,
      "lastSignature" TEXT,
      UNIQUE ("sessionID", "coValue")
    );`,
		'CREATE INDEX IF NOT EXISTS sessionsByCoValue ON sessions ("coValue");',
		`CREATE TABLE IF NOT EXISTS coValues (
      "rowID" SERIAL PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      header TEXT NOT NULL
    );`,
		'CREATE INDEX IF NOT EXISTS coValuesByID ON coValues (id);',
	],
	3: [
		`CREATE TABLE IF NOT EXISTS signatureAfter (
      ses INTEGER,
      idx INTEGER,
      signature TEXT NOT NULL,
      PRIMARY KEY (ses, idx)
    );`,
		'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "bytesSinceLastSignature" INTEGER;',
	],
	4: [
		`CREATE TABLE IF NOT EXISTS unsynced_covalues (
      "rowID" SERIAL PRIMARY KEY,
      "co_value_id" TEXT NOT NULL,
      "peer_id" TEXT NOT NULL,
      UNIQUE ("co_value_id", "peer_id")
    );`,
		'CREATE INDEX IF NOT EXISTS idx_unsynced_covalues_co_value_id ON unsynced_covalues("co_value_id");',
	],
	5: [
		`CREATE TABLE IF NOT EXISTS deletedCoValues (
      "coValueID" TEXT PRIMARY KEY,
      status INTEGER NOT NULL DEFAULT 0
    );`,
		'CREATE INDEX IF NOT EXISTS deletedCoValuesByStatus ON deletedCoValues (status);',
	],
}

export async function getMigrationVersion(db) {
	try {
		const result = await db.query('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
		return result.rows[0]?.version || 0
	} catch {
		return 0
	}
}

export async function saveMigrationVersion(db, version) {
	await db.exec(
		`CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
	)
	await db.query(
		'INSERT INTO schema_version (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
		[version],
	)
}

export async function runMigrations(db) {
	const currentVersion = await getMigrationVersion(db)
	const versions = Object.keys(migrations)
		.map((v) => parseInt(v, 10))
		.filter((v) => v > currentVersion)
		.sort((a, b) => a - b)

	for (const version of versions) {
		const queries = migrations[version]
		for (const query of queries) {
			await db.exec(query)
		}
		await saveMigrationVersion(db, version)
	}
}
