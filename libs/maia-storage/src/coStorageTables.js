/**
 * CoJSON persistence tables from schema/postgres.js migrations.
 * PostgreSQL folds unquoted identifiers to lowercase — use these names in SQL.
 * Excludes schema_version: migrations may insert rows before any CoJSON data exists;
 * we must still seed in that case.
 */
export const COJSON_DATA_TABLES = [
	'transactions',
	'sessions',
	'covalues',
	'signatureafter',
	'unsynced_covalues',
	'deletedcovalues',
]
