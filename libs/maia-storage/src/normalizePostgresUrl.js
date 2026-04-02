/**
 * Normalize PEER_SYNC_DB_URL so pg / pg-connection-string do not emit SSL mode deprecation warnings.
 * Maps sslmode=require|prefer|verify-ca to verify-full (explicit current behavior per libpq docs).
 *
 * @param {string} connectionString
 * @returns {string}
 */
export function normalizePostgresConnectionString(connectionString) {
	if (!connectionString || typeof connectionString !== 'string') return connectionString
	try {
		const u = new URL(connectionString)
		const mode = u.searchParams.get('sslmode')
		if (mode === 'require' || mode === 'prefer' || mode === 'verify-ca') {
			u.searchParams.set('sslmode', 'verify-full')
		}
		return u.toString()
	} catch {
		return connectionString
	}
}
