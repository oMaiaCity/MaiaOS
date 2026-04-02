/**
 * Browser stub for PGlite adapter - never loaded in browser (getStorage returns IndexedDB).
 * Exported so bundlers resolve this via package.json "browser" condition instead of real pglite.
 * Avoids pulling @electric-sql/pglite into client bundles.
 */

import { OPS_PREFIX } from '@MaiaOS/logs'

export async function getPGliteStorage() {
	throw new Error(`${OPS_PREFIX.STORAGE} PGlite is server-only - use IndexedDB in browser`)
}
