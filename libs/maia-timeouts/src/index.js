/**
 * Centralized timeouts for the bootstrap + sync path.
 *
 * Single source of truth so there is no cascading 20s×N wait chain anywhere.
 * Tune here, not in call sites.
 *
 * Budget rationale:
 *   - WS connect: 10s (most Fly cold starts < 6s; leave margin for slow networks).
 *   - CoValue load: 5s (synced covalues resolve in < 1s once WS is up).
 *   - Bootstrap HTTP: 30s (server cold start + guardian promote + identity index write; server enforces 35s).
 *   - Storage persist: 30s (PGlite / IndexedDB flush; storage is local, should be fast).
 */

export const TIMEOUT_WS_CONNECT = 10000
export const TIMEOUT_COVALUE_LOAD = 5000
export const TIMEOUT_HTTP = 30000
export const TIMEOUT_STORAGE_PERSIST = 30000
