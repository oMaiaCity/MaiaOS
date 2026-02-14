/**
 * Moai server bundle entry.
 * Single entry point: @MaiaOS/loader (like client).
 * Core re-exports db, operations, self internally.
 */
export {
	CoJSONBackend,
	DBEngine,
	loadOrCreateAgentAccount,
	waitForStoreReady,
} from '@MaiaOS/loader'
