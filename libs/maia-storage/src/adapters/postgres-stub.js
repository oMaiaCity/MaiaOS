/**
 * Browser stub for Postgres adapter - never loaded in browser (getStorage returns IndexedDB).
 * Exported so bundlers resolve this via package.json "browser" condition instead of real postgres.
 * Avoids pulling pg/dns/tls into client bundles.
 */

import { OPS_PREFIX } from '@MaiaOS/logs'

export async function getPostgresStorage() {
	throw new Error(`${OPS_PREFIX.STORAGE} Postgres is server-only - use IndexedDB in browser`)
}
