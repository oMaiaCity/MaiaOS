/**
 * Normalize PEER_SYNC_DB_URL: safe sslmode tweaks, connect timeout, app name.
 * - Keeps `sslmode=require` (Neon / pooler). Maps deprecated `prefer` → `require`, `verify-ca` → `verify-full`.
 * - Does not force `require` → `verify-full` (that broke some Neon pooler hostnames in the wild).
 *
 * @param {string} connectionString
 * @returns {string}
 */
export function normalizePostgresConnectionString(connectionString) {
	if (!connectionString || typeof connectionString !== 'string') return connectionString
	try {
		const u = new URL(connectionString)
		const mode = u.searchParams.get('sslmode')
		if (mode === 'prefer') {
			u.searchParams.set('sslmode', 'require')
		} else if (mode === 'verify-ca') {
			u.searchParams.set('sslmode', 'verify-full')
		}
		if (!u.searchParams.has('connect_timeout') && !u.searchParams.has('connect-timeout')) {
			u.searchParams.set('connect_timeout', '15')
		}
		if (!u.searchParams.get('application_name')?.trim()) {
			u.searchParams.set('application_name', 'maia-sync')
		}
		return u.toString()
	} catch {
		return connectionString
	}
}
